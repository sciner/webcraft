import fs from 'fs';
import {Vector} from "@client/helpers/vector.js";
import {AABB} from "@client/core/AABB.js";
import { Schematic } from 'madcraft-schematic-reader';
import {FileBuffer, TFileBufferCookie} from "./file_buffer.js";

/**
 * На сколько блоков хранится 1 инкрементное смещение (1 байт) - см. {@link BinarySchematic.incrementalOffsets}.
 * Это для ускорения поиска в упакованном varInt массиве. Мненьше значение = больше потребление памяти, быстрее.
 * Разумно задать {@link BLOCKS_PER_INCREMENTAL_OFFSET} 10..50.
 * например, 20 - значит на индексы тратится дополнительно чуть меньше чем (1/20) памяти
 */
const BLOCKS_PER_INCREMENTAL_OFFSET = 32

/** На сколько инкрементых смещений хранится 1 смещение (4 байта). Разумные значения 10..20. */
const INCREMENTAL_OFFSETS_PER_OFFSET = 16

const BLOCKS_PER_OFFSET = BLOCKS_PER_INCREMENTAL_OFFSET * INCREMENTAL_OFFSETS_PER_OFFSET

/**
 * Аналогично {@link TFileBufferCookie}, но дополнительно содержит поля, используемые
 * классом {@link BinarySchematic}.
 *
 * Пользователь не должен заполнять эту структуру и не должен знать что в ней, только передать ее
 * в тот же класс при следующем открытии того же файла. Поэтому называется cookie.
 */
export type TBinarySchematicCookie = TFileBufferCookie & {
    format?: string
    /**
     * Если true, то используется внешний NBT парсер. Он медленнее и ограничен по объему файла.
     * Только на случай если новый парсер не может прочесть.
     */
    useExternalParser?: boolean
}

/**
 * Читает, распаковывает и хранит бинарные данные схематики. Парсит NBT. Читает блоки из бинарных данных.
 * Преобразует координаты (зеркально отражает по Z).
 * Отличие от {@link SchematicReader}: низкоуровневый класс, работает только с бинарными данными, не анализирует поля блоков.
 */
export class BinarySchematic {

    private schematic: Schematic
    /** Загруженный или открытый файл, откуда читаются несжатые данные. Если не null, то используется новый парсер. Иначе - старый. */
    private fileBuf?: FileBuffer | null
    private closed = false
    private cookie: TBinarySchematicCookie
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
     *   Для чтения блоков нужно использовать {@link getBlocks}
     */
    async open(fileName: string, temporaryFileName: string, cookie: TBinarySchematicCookie): Promise<Schematic> {
        this.cookie = cookie

        // пробуем прочесть новым парсером
        if (!cookie.useExternalParser) {
            try {
                // читаем файл
                const fileBuf = new FileBuffer()
                this.fileBuf = fileBuf
                await fileBuf.open(fileName, temporaryFileName, cookie)
                if (this.closed) {
                    throw 'closed'
                }

                // парсим nbt
                const nbt = this.parseNBT()

                // вычислить смещения в байтах для некоторых упакованных блоков для быстрого доступа по координатам
                const {offset, length} = nbt.BlockData
                fileBuf.setOffset(offset)
                let prevOffset = 0
                const endOffset = offset + length
                this.offsets = new Uint32Array(Math.ceil(length / BLOCKS_PER_OFFSET))
                this.incrementalOffsets = new Uint8Array(Math.ceil(length / BLOCKS_PER_INCREMENTAL_OFFSET))
                let blockIndex = 0
                let incrementalOffsetIndex = 0 // индекс в массиве incrementalOffsets
                const volume = nbt.Width * nbt.Height * nbt.Length

                while(blockIndex < volume) { // цикл по грппе блоков с одним offsets
                    this.offsets[blockIndex / BLOCKS_PER_OFFSET | 0] = fileBuf.offset
                    const bigGroupEnd = Math.min(blockIndex + BLOCKS_PER_OFFSET, volume)

                    // пропустить блоки до следующего индекса кратного BLOCKS_PER_OFFSET
                    while(blockIndex < bigGroupEnd) {
                        this.incrementalOffsets[incrementalOffsetIndex++] = fileBuf.offset - prevOffset
                        prevOffset = fileBuf.offset
                        const smallGroupEnd = Math.min(blockIndex + BLOCKS_PER_INCREMENTAL_OFFSET, volume)

                        // пропустить блоки до следующего индекса кратного BLOCKS_PER_INCREMENTAL_OFFSET
                        while(blockIndex < smallGroupEnd) {
                            // пропустить 1 упакованный блок, провалидировать его длину
                            let varIntLength = 1
                            while ((fileBuf.readByte() & 128) !== 0) {
                                if (++varIntLength > 5) {
                                    throw new Error('VarInt too big (probably corrupted data)')
                                }
                            }
                            blockIndex++
                        }
                    }
                }
                if (fileBuf.offset !== endOffset) {
                    throw new Error("BlockData length doesn't match")
                }

                // постпроцессинг тэгов через sponge или mcedit
                nbt.BlockData = [] // передать в sponge или mcedit пустой массив, чтобы они не тратили время на него
                this.schematic = Schematic.parse(nbt)
                this.schematic.blocks = null // чтобы не обратиться к этому полю случайно
            } catch (e) {
                cookie.useExternalParser = true
                await this.fileBuf.close()
                this.fileBuf = null
            }
        }

        // пробуем прочесть старым парсером
        if (cookie.useExternalParser) {
            const buffer = await fs.promises.readFile(fileName)
            if (this.closed) {
                throw 'closed'
            }
            this.schematic = await Schematic.read(buffer) // одновременно парсит NBT и постпроцессит тэги
            if (this.closed) {
                throw 'closed'
            }
        }

        // настроить размер
        this.size = new Vector(this.schematic.size) // или: new Vector(parsed.Width, parsed.Height, parsed.Length)
        this.aabb = new AABB().setCornerSize(Vector.ZERO, this.size)
        this.strideZ = this.size.x
        this.strideY = this.strideZ * this.size.z
        return this.schematic
    }

    async close() {
        this.closed = true
        return this.fileBuf.close()
    }

    /**
     * Возвращает все блоки из указанной обалсти.
     * @param aabb - читаемая часть схематики в СК схематики (не добавляет автоматически offset из Metadata).
     * @return координаты в СК мира, номера блоков в палитре
     */
    *getBlocks(aabb: AABB = this.aabb): IterableIterator<[pos: Vector, paletteIndex: int]> {
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
        if (this.cookie.useExternalParser) {
            const {blocks} = this.schematic
            for(let y = aabb.y_min; y < aabb.y_max; y++) {
                vec.y = y
                for(let z = z_min; z < z_max; z++) {
                    vec.z = (size.z - 1 - z) // отразить по z - перевсести в систему координат madcraft
                    let offset = y * strideY + z * strideZ + x_min
                    for(let x = x_min; x < x_max; x++) {
                        vec.x = x
                        tmpIterationEntry[1] = blocks[offset++]
                        yield tmpIterationEntry
                    }
                }
            }
            return
        }

        const {offsets, incrementalOffsets, fileBuf} = this
        // оценка длины читаемой строки в байтах - по 2 байта на блок. Сорее всего меньше, но может быть и больше (если больше - это ок)
        const estimatedLineLengthBytes = (x_max - x_min) * 2
        // цкилы по (y, z) - началу непрерывной строки блоков
        for(let y = aabb.y_min; y < aabb.y_max; y++) {
            vec.y = y
            for(let z = z_min; z < z_max; z++) {
                vec.z = (size.z - 1 - z) // отразить по z - перевсести в систему координат madcraft

                // найти начало строки приблизительно с помощью сохраненных смещений
                const index = y * strideY + z * strideZ + x_min
                const offsetIndex = index / BLOCKS_PER_OFFSET | 0
                let roughOffset = offsets[offsetIndex]

                // уточнить смещение по инкрементам
                let incrementalOffsetIndex = offsetIndex * INCREMENTAL_OFFSETS_PER_OFFSET
                const maxIncrementalOffsetIndex = index / BLOCKS_PER_INCREMENTAL_OFFSET | 0
                while (incrementalOffsetIndex < maxIncrementalOffsetIndex) {
                    roughOffset += incrementalOffsets[++incrementalOffsetIndex]
                }

                // найти смещение строки точно - пропустить ненужные блоки
                fileBuf.setOffset(roughOffset, estimatedLineLengthBytes)
                const skipCount = index - incrementalOffsetIndex * BLOCKS_PER_INCREMENTAL_OFFSET
                for(let j = 0; j < skipCount; j++) {
                    while ((fileBuf.readByte() & 128) !== 0) {
                        // ничего
                    }
                }

                // по всем блокам строки
                for(let x = x_min; x < x_max; x++) {
                    vec.x = x
                    // распаковать значение блока. Повтор кода - см. readVarInt
                    let byte = fileBuf.readByte()
                    let value = byte & 127
                    let varintLength = 0
                    while ((byte & 128) !== 0) {
                        byte = fileBuf.readByte()
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
     * Читает NBT тэги и распаковывает в объект все кроме BlockData из {@link fileBuf}.
     * Всесто BlockData возвращает объект {offset, length}, показывающий его позицию в буфере.
     */
    private parseNBT(): Dict {

        // См. readSignedVarInt в prismarine-nbt/compiler-zigzag.js
        function readSignedVarInt(): int {
            let result = 0
            let varintLength = 0
            let b: int
            do {
                b = fileBuf.readByte()
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
            return fileBuf.readString(length)
        }

        function readTag(tagType: int, name?: string): any {
            const reader = readers[tagType]
            if (!reader) {
                throw new Error(`unsupported tag type ${tagType}`)
            }
            return reader(name)
        }

        const {fileBuf} = this
        //const dataLength = buffer.length

        // функции для разных типов кодирования чисел
        let readInt64   : () => bigint
        let readStingLength: () => int
        let readArrayLength: () => int
        const readers: ((name?: string) => any)[] = []

        const header = [fileBuf.readByte(), fileBuf.readByte(), fileBuf.readByte(), fileBuf.readByte()]
        const hasBedrockLevelHeader = header[1] === 0 && header[2] === 0 && header[3] === 0 // bedrock level.dat header
        const bedrockHeaderLength = hasBedrockLevelHeader ? 8 : 0
        const formats = (this.cookie.format && [this.cookie.format]) ??
            (hasBedrockLevelHeader ? ['little'] : ['big', 'little', 'littleVarint'])
        // пытаемся прочесть в разных форматах
        for(const format of formats) {
            this.cookie.format = format
            // настроить функции чтения
            fileBuf.littleEndian = format !== 'big'
            readStingLength = () => fileBuf.readInt16()
            readArrayLength = () => fileBuf.readInt32()
            if (format === 'littleVarint') {
                // Этот случай не тестировался и почти наверняка не работет.
                // Если найдется такая схематика - можно будет на ней отладить.
                readInt64 = readSignedVarLong
                readStingLength = readSignedVarInt
                readArrayLength = readSignedVarInt
            }
            // типы тэгов: https://minecraft.fandom.com/wiki/NBT_format#TAG_definition
            readers[1] = () => fileBuf.readByte()
            readers[2] = () => fileBuf.readInt16()
            readers[3] = () => fileBuf.readInt32()
            readers[4] = () => fileBuf.readBigInt64()
            readers[5] = () => fileBuf.readFloat32()
            readers[6] = () => fileBuf.readFloat64()
            readers[7] = (name?: string) => { // TAG_Byte_Array
                    const length = readArrayLength()
                    if (name === 'BlockData') {
                        const result = { offset: fileBuf.offset, length }
                        fileBuf.skip(length)
                        return result
                    }
                    const result = new Uint8Array(length)
                    for(let i = 0; i < length; i++) {
                        result[i] = fileBuf.readByte()
                    }
                    return result
                }
            readers[8] = readString
            readers[9] = () => {    // TAG_List
                    const listTagType = fileBuf.readByte()
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
                    while(subTagType = fileBuf.readByte()) {
                        const name = readString()
                        result[name] = readTag(subTagType, name)
                    }
                    return result
                }
            readers[11] = () => {   // TAG_Int_Array
                    const length = readArrayLength()
                    const result = new Array(length)
                    for(let i = 0; i < length; i++) {
                        result[i] = fileBuf.readInt32()
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
                fileBuf.setOffset(bedrockHeaderLength)
                while (fileBuf.offset !== fileBuf.size) {
                    const tagType = fileBuf.readByte()
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

}