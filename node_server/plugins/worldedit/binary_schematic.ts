import fs from 'fs';
import * as zlib from 'zlib';
import type { Readable } from 'stream'
import {Vector} from "@client/helpers/vector.js";
import {AABB} from "@client/core/AABB.js";
import { Schematic } from 'madcraft-schematic-reader';

/**
 * На сколько блоков хранится 1 инкрементное смещение (1 байт) - см. {@link BinarySchematic.incrementalOffsets}.
 * Это для ускорения поиска в упакованном varint массиве. Мненьше значение = больше потребление памяти, быстрее.
 * Разумно задать {@link BLOCKS_PER_INCREMENTAL_OFFSET} 10..50.
 * например, 20 - значит на индексы тратится дополнительно чуть меньше чем (1/20) памяти
 */
const BLOCKS_PER_INCREMENTAL_OFFSET = 32

/** На сколько инкрементых смещений хранится 1 смещение (4 байта). Разумные значения 10..20. */
const INCREMENTAL_OFFSETS_PER_OFFSET = 16

const BLOCKS_PER_OFFSET = BLOCKS_PER_INCREMENTAL_OFFSET * INCREMENTAL_OFFSETS_PER_OFFSET

/**
 * Читает, распаковывает и хранит бинарные данные схематики. Парсит NBT. Читает блоки из бинарных данных.
 * Преобразует координаты (зеркально отражает по Z) -
 * Отличие от {@link SchematicReader}: низкоуровневый класс, работает только с бинарными данными, не анализирует поля блоков.
 */
export class BinarySchematic {

    /**
     * Если true, то не используется бинарный формат, а читается по-старому через внешний парсер.
     * Тогда блоки берутся из {@link schematic}
     */
    private useExternalParser: boolean
    private schematic: Schematic

    private buffer: Buffer
    size: Vector
    aabb: AABB

    /** i-й элемент - номер байта, с которого начинается (i * BLOCKS_PER_OFFSET)-й блок */
    private offsets: Uint32Array
    /**
     * i-й элемент - смещение в байтах блока (i * BLOCKS_PER_INCREMENTAL_OFFSET) относительно блока
     * ((i - 1) * BLOCKS_PER_INCREMENTAL_OFFSET)
     */
    private incrementalOffsets: Uint8Array
    private strideZ: int
    private strideY: int

    private tmpIterationEntry: [Vector, int] = [new Vector(), 0]

    /**
     * Читает, распаковывает, парсит NBT, индексирует varint блоки для быстрого доступа.
     * Обрабатывает схематику вызовом Sponge или McEdit.
     * @param useExternalParser - если true, то используется внешний NBT парсер. Он медленнее и ограничен
     *   по объему файла. Только на случай если этот парсер не может прочесть
     * @return схематикиа, обработанная Sponge или McEdit. Она содержит все кроме массива блоков.
     *   Для чтения блоков нужно использовать {@link ofAABB}
     */
    async read(fileName: string, useExternalParser = false): Promise<Schematic> {
        this.useExternalParser = useExternalParser
        if (useExternalParser) {
            const buffer = await fs.promises.readFile(fileName)
            this.schematic = await Schematic.read(buffer) // одновременно парсит NBT и постпроцессит тэги
        } else {
            // читаем бинарный формат
            const buffer = await this.readFile(fileName)
            this.buffer = buffer

            const nbt = this.parseNBT(buffer)

            // вычислить смещения в байтах для некоторых упакованных блоков для быстрого доступа по координатам
            let {offset, length} = nbt.BlockData
            let prevOffset = 0
            const endOffset = offset + length
            this.offsets = new Uint32Array(Math.ceil(length / BLOCKS_PER_OFFSET))
            this.incrementalOffsets = new Uint8Array(Math.ceil(length / BLOCKS_PER_INCREMENTAL_OFFSET))
            let blockIndex = 0
            let incrementalOffsetIndex = 0 // индекс в массиве incrementalOffsets
            const volume = nbt.Width * nbt.Height * nbt.Length

            while(blockIndex < volume) { // цикл по грппе блоков с одним offsets
                this.offsets[blockIndex / BLOCKS_PER_OFFSET | 0] = offset
                const bigGroupEnd = Math.min(blockIndex + BLOCKS_PER_OFFSET, volume)

                // пропустить блоки до следующего индекса кратного BLOCKS_PER_OFFSET
                while(blockIndex < bigGroupEnd) {
                    this.incrementalOffsets[incrementalOffsetIndex++] = offset - prevOffset
                    prevOffset = offset
                    const smallGroupEnd = Math.min(blockIndex + BLOCKS_PER_INCREMENTAL_OFFSET, volume)

                    // пропустить блоки до следующего индекса кратного BLOCKS_PER_INCREMENTAL_OFFSET
                    while(blockIndex < smallGroupEnd) {
                        // пропустить 1 упакованный блок, провалидировать его длину
                        let varIntLength = 1
                        while ((buffer[offset++] & 128) !== 0) {
                            if (++varIntLength > 5) {
                                throw new Error('VarInt too big (probably corrupted data)')
                            }
                        }
                        blockIndex++
                    }
                }
            }
            if (offset !== endOffset) {
                throw new Error("BlockData length doesn't match")
            }

            // постпроцессинг тэгов через sponge или mcedit
            nbt.BlockData = [] // передать в sponge или mcedit пустой массив, чтобы они не тратили время на него
            this.schematic = Schematic.parse(nbt)
            this.schematic.blocks = null // чтобы не обратиться к этому полю случайно
        }
        // настроить размер
        this.size = new Vector(this.schematic.size) // или: new Vector(parsed.Width, parsed.Height, parsed.Length)
        this.aabb = new AABB().setCornerSize(Vector.ZERO, this.size)
        this.strideZ = this.size.x
        this.strideY = this.strideZ * this.size.z
        return this.schematic
    }

    /**
     * Возвращает все блоки из указанной обалсти.
     * @param pos0 - позиция угла схематики в мире, добавляется к выходным координатам
     * @param aabb - читаемая часть схематики в СК схематики (не добавляет автоматически offset из Metadata).
     * @return координаты в СК мира, номера блоков в палитре
     */
    *ofAABB(pos0: IVector, aabb: AABB): IterableIterator<[pos: Vector, paletteIndex: int]> {
        const {strideZ, strideY, tmpIterationEntry, size} = this
        const vec = tmpIterationEntry[0]
        const {x_min, x_max} = aabb
        if (!this.aabb.containsAABB(aabb)) {
            throw 'requested AABB is outside the schematic'
        }
        // отразить по z - перевсести в систему координат схематики
        const z_min = size.z - aabb.z_max
        const z_max = size.z - aabb.z_min

        // если блоки не в бинароном формате
        if (this.useExternalParser) {
            const {blocks} = this.schematic
            for(let y = aabb.y_min; y < aabb.y_max; y++) {
                vec.y = pos0.y + y
                for(let z = z_min; z < z_max; z++) {
                    vec.z = pos0.z + (size.z - 1 - z) // отразить по z - перевсести в систему координат madcraft
                    let offset = y * strideY + z * strideZ + x_min
                    for(let x = x_min; x < x_max; x++) {
                        vec.x = pos0.x + x
                        tmpIterationEntry[1] = blocks[offset++]
                        yield tmpIterationEntry
                    }
                }
            }
            return
        }

        const {offsets, incrementalOffsets, buffer} = this
        // цкилы по (y, z) - началу непрерывной строки блоков
        for(let y = aabb.y_min; y < aabb.y_max; y++) {
            vec.y = pos0.y + y
            for(let z = z_min; z < z_max; z++) {
                vec.z = pos0.z + (size.z - 1 - z) // отразить по z - перевсести в систему координат madcraft

                // найти начало строки приблизительно с помощью сохраненных смещений
                const index = y * strideY + z * strideZ + x_min
                const offsetIndex = index / BLOCKS_PER_OFFSET | 0
                let offset = offsets[offsetIndex]

                // уточнить смещение по инкрементам
                let incrementalOffsetIndex = offsetIndex * INCREMENTAL_OFFSETS_PER_OFFSET
                const maxIncrementalOffsetIndex = index / BLOCKS_PER_INCREMENTAL_OFFSET | 0
                while (incrementalOffsetIndex < maxIncrementalOffsetIndex) {
                    offset += incrementalOffsets[++incrementalOffsetIndex]
                }

                // найти смещение строки точно - пропустить ненужные блоки
                const skipCount = index - incrementalOffsetIndex * BLOCKS_PER_INCREMENTAL_OFFSET
                for(let j = 0; j < skipCount; j++) {
                    while ((buffer[offset++] & 128) !== 0) {
                        // ничего
                    }
                }

                // по все блокам строки
                for(let x = x_min; x < x_max; x++) {
                    vec.x = pos0.x + x
                    // распаковать значение блока. Повтор кода - см. readVarInt
                    let byte = buffer[offset++]
                    let value = byte & 127
                    let varintLength = 0
                    while ((byte & 128) !== 0) {
                        byte = buffer[offset++]
                        varintLength += 7
                        value |= (byte & 127) << varintLength
                    }
                    // вызать результат
                    tmpIterationEntry[1] = value
                    yield tmpIterationEntry
                }
            }
        }
    }

    /**
     * Читает NBT тэги и распаковывает в объект все кроме BlockData.
     * Всесто BlockData возвращает объект {offset, length}, показывающий его позицию в буфере.
     */
    private parseNBT(buffer: Buffer): Dict {

        function readByte(): int {
            return dataView.getInt8(offset++)
        }

        // См. readSignedVarInt в prismarine-nbt/compiler-zigzag.js
        function readSignedVarInt(): int {
            let result = 0
            let varintLength = 0
            let b: int
            do {
                b = dataView.getInt8(offset++)
                result |= (b & 127) << varintLength
                varintLength += 7
                if (varintLength > 31) {
                    throw new Error('VarInt too big (probably corrupted data)')
                }
            } while ((b & 128) !== 0)
            // Может быть эта строка переставляет бит знака? скопировал ее из compiler-zigzag.js
            return ((((result << 63) >> 63) ^ result) >> 1) ^ (result & (1 << 63))
        }

        function readSignedVarLong(): bigint {
            // Код в readSignedVarLong в prismarine-nbt/compiler-zigzag.js даже не компилируется.
            // Похоже, они что-то написали и видимо даже не тестировали.
            throw 'unsupported'
        }

        function readString(): string {
            const length = readStingLength()
            if (offset + length >= dataLength) {
                throw 'buffer underflow while reading string'
            }
            const dataView = new DataView(buffer.buffer, offset, length)
            offset += length
            return utf8decoder.decode(dataView)
        }

        function readTag(tagType: int, name?: string): any {
            const reader = readers[tagType]
            if (!reader) {
                throw new Error(`unsupported tag type ${tagType}`)
            }
            return reader(name)
        }

        const dataLength = buffer.length

        // временные объекты для парсинга
        const utf8decoder = new TextDecoder('utf-8')
        const dataView = new DataView(buffer.buffer)

        // функции для разных типов кодирования чисел
        let readShort   : () => int
        let readInt     : () => int
        let readFloat   : () => float
        let readDouble  : () => float
        let readInt64   : () => bigint
        let readStingLength: () => int
        let readArrayLength: () => int
        const readers: ((name?: string) => any)[] = []

        const hasBedrockLevelHeader = buffer[1] === 0 && buffer[2] === 0 && buffer[3] === 0 // bedrock level.dat header
        const bedrockHeaderLength = hasBedrockLevelHeader ? 8 : 0
        const formats = hasBedrockLevelHeader ? ['little'] : ['big', 'little', 'littleVarint']
        let offset: int
        // пытаемся прочесть в разных форматах
        for(const format of formats) {
            // настроить функции чтения
            const isLittle = format !== 'big'
            readShort = () => {
                const res = dataView.getInt16(offset, isLittle)
                offset += 2
                return res
            }
            readInt = () => {
                const res = dataView.getInt32(offset, isLittle)
                offset += 4
                return res
            }
            readInt64 = () => {
                const res = dataView.getBigInt64(offset, isLittle)
                offset += 8
                return res
            }
            readFloat = () => {
                const res = dataView.getFloat32(offset, isLittle)
                offset += 4
                return res
            }
            readDouble = () => {
                const res = dataView.getFloat64(offset, isLittle)
                offset += 8
                return res
            }
            readStingLength = readShort
            readArrayLength = readInt
            if (format === 'littleVarint') {
                // Этот случай не тестировался и почти наверняка не работет.
                // Если найдется такая схематика - можно будет на ней отладить.
                readInt64 = readSignedVarLong
                readStingLength = readSignedVarInt
                readArrayLength = readSignedVarInt
            }
            // типы тэгов: https://minecraft.fandom.com/wiki/NBT_format#TAG_definition
            readers[1] = readByte
            readers[2] = readShort
            readers[3] = readInt
            readers[4] = readInt64
            readers[5] = readFloat
            readers[6] = readDouble
            readers[7] = (name?: string) => { // TAG_Byte_Array
                    const length = readArrayLength()
                    if (name === 'BlockData') {
                        const result = { offset, length }
                        offset += length
                        return result
                    }
                    const result = new Uint8Array(length)
                    for(let i = 0; i < length; i++) {
                        result[i] = readByte()
                    }
                    return result
                }
            readers[8] = readString
            readers[9] = () => {    // TAG_List
                    const listTagType = readByte()
                    const listLength = readArrayLength()
                    const result = new Array(listLength)
                    for(let i = 0; i < listLength; i++) {
                        result[i] = readTag(listTagType)
                    }
                    return result
                }
            readers[10] = () => {   // TAG_Compound
                    const result = {}
                    let subTagType: int
                    while(subTagType = readByte()) {
                        const name = readString()
                        result[name] = readTag(subTagType, name)
                    }
                    return result
                }
            readers[11] = () => {   // TAG_Int_Array
                    const length = readArrayLength()
                    const result = new Array(length)
                    for(let i = 0; i < length; i++) {
                        result[i] = readInt()
                    }
                    return result
                }
            readers[12] =  () => {  // TAG_Long_Array
                    const length = readArrayLength()
                    const result = new Array(length)
                    for(let i = 0; i < length; i++) {
                        result[i] = readInt64()
                    }
                    return result
                }

            // попробовать прочитать в этом формате
            let result = {}
            try {
                offset = bedrockHeaderLength
                while (offset !== dataLength) {
                    const tagType = readByte()
                    if (tagType === 0) {
                        break
                    }
                    const name = readString()
                    result[name] = readTag(tagType, name)
                }
            } catch (e) {
                continue // попробовать следующий формат
            }
            // "вытащить" данные на 1 уровень выше из объекта
            const values = Object.values(result)
            if (values.length == 1) {
                result = values[0]
            }
            return result
        }
        throw 'No format matches.'
    }

    /** Читает несжатый или распаковывает сжатый файл в память. */
    private async readFile(fileName: string): Promise<Buffer> {
        // проверить сжатый ли файл
        let header: Buffer
        await new Promise((resolve, reject) => {
            fs.createReadStream(fileName, {start: 0, end: 2})
                .on('data', (buf: Buffer) => { header = buf })
                .on('end', resolve)
                .on('error', reject)
        })
        const zipped = header[0] === 0x1f && header[1] === 0x8b
        // узнать размер и подготовить чтение в буфер
        let stream: Readable
        let length = 0
        if (zipped) {
            // Прочитать 1-й раз чтобы узнать размер.
            // Почему читаем 2 раза: чтобы сразу выделить буфер нужного размера. Так дольше, но ниже пиковое выделение памяти.
            await new Promise((resolve, reject) => {
                const unzipStream = zlib.createGunzip()
                fs.createReadStream(fileName).pipe(unzipStream)
                unzipStream.on('data', (chunk: Buffer) => {
                    length += chunk.length
                }).on('end', resolve)
                    .on('error', reject)
            })
            // Подготовиться к чтению 2-й раз
            const unzipStream = zlib.createGunzip()
            fs.createReadStream(fileName).pipe(unzipStream)
            stream = unzipStream
        } else {
            // подготовиться к чтению несжатого файла
            length = (await fs.promises.stat(fileName)).size
            stream = fs.createReadStream(fileName)
        }
        // прочитать из потока в память
        return new Promise<Buffer>((resolve, reject) => {
            const result = new Buffer(length)
            let offset = 0
            stream.on('data', (chunk: Buffer) => {
                chunk.copy(result, offset)
                offset += chunk.length
            }).on('end', () => {
                resolve(result)
            }).on('error', reject)
        })
    }

}