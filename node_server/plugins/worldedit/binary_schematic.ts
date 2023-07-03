import fs from 'fs';
import {Vector} from "@client/helpers/vector.js";
import {AABB} from "@client/core/AABB.js";
import { Schematic } from 'madcraft-schematic-reader';
import {FileBuffer, TFileBufferCookie} from "./file_buffer.js";

/**
 * На сколько блоков хранится 1 инкрементное смещение (1 байт) - см. {@link BinarySchematic.incremental_offsets}.
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
    use_external_parser?: boolean
}

/**
 * Читает, распаковывает и хранит бинарные данные схематики. Парсит NBT. Читает блоки из бинарных данных.
 * Преобразует координаты (зеркально отражает по Z).
 * Отличие от {@link SchematicReader}: низкоуровневый класс, работает только с бинарными данными, не анализирует поля блоков.
 */
export class BinarySchematic {

    private schematic: Schematic
    /** Загруженный или открытый файл, откуда читаются несжатые данные. Если не null, то используется новый парсер. Иначе - старый. */
    private file_buffer?: FileBuffer | null
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
    private incremental_offsets: Uint8Array
    private strideZ: int
    private strideY: int

    private tmp_iteration_entry: [Vector, int] = [new Vector(), 0]

    /**
     * Читает, распаковывает, парсит NBT, индексирует varint блоки для быстрого доступа.
     * Обрабатывает схематику вызовом Sponge или McEdit.
     * @param use_external_parser - если true, то используется внешний NBT парсер. Он медленнее и ограничен
     *   по объему файла. Только на случай если этот парсер не может прочесть
     * @return схематикиа, обработанная Sponge или McEdit. Она содержит все кроме массива блоков.
     *   Для чтения блоков нужно использовать {@link getBlocks}
     */
    async open(fileName: string, temporary_file_name: string, max_memory_file_size: int, cookie: TBinarySchematicCookie): Promise<Schematic> {
        this.cookie = cookie

        // пробуем прочесть новым парсером
        if (!cookie.use_external_parser) {
            try {
                // читаем файл
                const file_buffer = new FileBuffer()
                this.file_buffer = file_buffer
                await file_buffer.open(fileName, temporary_file_name, max_memory_file_size, cookie)
                if (this.closed) {
                    throw 'closed'
                }

                // парсим nbt
                const nbt = this.parseNBT()

                // вычислить смещения в байтах для некоторых упакованных блоков для быстрого доступа по координатам
                const {offset, length} = nbt.BlockData
                file_buffer.setOffset(offset)
                let prev_offset = 0
                const end_offset = offset + length
                this.offsets = new Uint32Array(Math.ceil(length / BLOCKS_PER_OFFSET))
                this.incremental_offsets = new Uint8Array(Math.ceil(length / BLOCKS_PER_INCREMENTAL_OFFSET))
                let block_index = 0
                let incremental_offset_index = 0 // индекс в массиве incremental_offsets
                const volume = nbt.Width * nbt.Height * nbt.Length

                while(block_index < volume) { // цикл по грппе блоков с одним offsets
                    this.offsets[block_index / BLOCKS_PER_OFFSET | 0] = file_buffer.offset
                    const big_group_end = Math.min(block_index + BLOCKS_PER_OFFSET, volume)

                    // пропустить блоки до следующего индекса кратного BLOCKS_PER_OFFSET
                    while(block_index < big_group_end) {
                        this.incremental_offsets[incremental_offset_index++] = file_buffer.offset - prev_offset
                        prev_offset = file_buffer.offset
                        const small_group_end = Math.min(block_index + BLOCKS_PER_INCREMENTAL_OFFSET, volume)

                        // пропустить блоки до следующего индекса кратного BLOCKS_PER_INCREMENTAL_OFFSET
                        while(block_index < small_group_end) {
                            // пропустить 1 упакованный блок, провалидировать его длину
                            let varint_length = 1
                            while ((file_buffer.readByte() & 128) !== 0) {
                                if (++varint_length > 5) {
                                    throw new Error('VarInt too big (probably corrupted data)')
                                }
                            }
                            block_index++
                        }
                    }
                }
                if (file_buffer.offset !== end_offset) {
                    throw new Error("BlockData length doesn't match")
                }

                // постпроцессинг тэгов через sponge или mcedit
                nbt.BlockData = [] // передать в sponge или mcedit пустой массив, чтобы они не тратили время на него
                this.schematic = Schematic.parse(nbt)
                this.schematic.blocks = null // чтобы не обратиться к этому полю случайно
            } catch (e) {
                console.error('New schematic parser failed, ' + (e.message ?? e))
                cookie.use_external_parser = true
                await this.file_buffer.close()
                this.file_buffer = null
            }
        }

        // пробуем прочесть старым парсером
        if (cookie.use_external_parser) {
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
        return this.file_buffer.close()
    }

    /**
     * Возвращает все блоки из указанной обалсти.
     * @param aabb - читаемая часть схематики в СК схематики (не добавляет автоматически offset из Metadata).
     * @return координаты в СК мира, номера блоков в палитре
     */
    *getBlocks(aabb: AABB = this.aabb): IterableIterator<[pos: Vector, paletteIndex: int]> {
        const {strideZ, strideY, tmp_iteration_entry, size} = this
        const vec = tmp_iteration_entry[0]
        const {x_min, x_max} = aabb
        if (!this.aabb.containsAABB(aabb)) {
            throw 'requested AABB is outside the schematic'
        }
        // отразить по z - перевсести в систему координат схематики
        const z_min = size.z - aabb.z_max
        const z_max = size.z - aabb.z_min

        // если блоки не в бинароном формате
        if (this.cookie.use_external_parser) {
            const {blocks} = this.schematic
            for(let y = aabb.y_min; y < aabb.y_max; y++) {
                vec.y = y
                for(let z = z_min; z < z_max; z++) {
                    vec.z = (size.z - 1 - z) // отразить по z - перевсести в систему координат madcraft
                    let offset = y * strideY + z * strideZ + x_min
                    for(let x = x_min; x < x_max; x++) {
                        vec.x = x
                        tmp_iteration_entry[1] = blocks[offset++]
                        yield tmp_iteration_entry
                    }
                }
            }
            return
        }

        const {offsets, incremental_offsets, file_buffer} = this
        // оценка длины читаемой строки в байтах - по 2 байта на блок. Сорее всего меньше, но может быть и больше (если больше - это ок)
        const estimated_line_length_bytes = (x_max - x_min) * 2
        // цкилы по (y, z) - началу непрерывной строки блоков
        for(let y = aabb.y_min; y < aabb.y_max; y++) {
            vec.y = y
            for(let z = z_min; z < z_max; z++) {
                vec.z = (size.z - 1 - z) // отразить по z - перевсести в систему координат madcraft

                // найти начало строки приблизительно с помощью сохраненных смещений
                const index = y * strideY + z * strideZ + x_min
                const offset_index = index / BLOCKS_PER_OFFSET | 0
                let rough_offset = offsets[offset_index]

                // уточнить смещение по инкрементам
                let incremental_offset_index = offset_index * INCREMENTAL_OFFSETS_PER_OFFSET
                const max_incremental_offset_index = index / BLOCKS_PER_INCREMENTAL_OFFSET | 0
                while (incremental_offset_index < max_incremental_offset_index) {
                    rough_offset += incremental_offsets[++incremental_offset_index]
                }

                // найти смещение строки точно - пропустить ненужные блоки
                file_buffer.setOffset(rough_offset, estimated_line_length_bytes)
                const skip_count = index - incremental_offset_index * BLOCKS_PER_INCREMENTAL_OFFSET
                for(let j = 0; j < skip_count; j++) {
                    while ((file_buffer.readByte() & 128) !== 0) {
                        // ничего
                    }
                }

                // по всем блокам строки
                for(let x = x_min; x < x_max; x++) {
                    vec.x = x
                    // распаковать значение блока. Повтор кода - см. readVarInt
                    let byte = file_buffer.readByte()
                    let value = byte & 127
                    let varint_length = 0
                    while ((byte & 128) !== 0) {
                        byte = file_buffer.readByte()
                        varint_length += 7
                        value |= (byte & 127) << varint_length
                    }
                    // вызать результат
                    tmp_iteration_entry[1] = value
                    yield tmp_iteration_entry
                }
            }
        }
    }

    /**
     * Читает NBT тэги и распаковывает в объект все кроме BlockData из {@link file_buffer}.
     * Всесто BlockData возвращает объект {offset, length}, показывающий его позицию в буфере.
     */
    private parseNBT(): Dict {

        // См. readSignedVarInt в prismarine-nbt/compiler-zigzag.js
        function readSignedVarInt(): int {
            let result = 0
            let varint_length = 0
            let b: int
            do {
                b = file_buffer.readByte()
                result |= (b & 127) << varint_length
                varint_length += 7
                if (varint_length > 31) {
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
            return file_buffer.readString(length)
        }

        function readTag(tag_type: int, name?: string): any {
            const reader = readers[tag_type]
            if (!reader) {
                throw new Error(`unsupported tag type ${tag_type}`)
            }
            return reader(name)
        }

        const {file_buffer} = this
        //const dataLength = buffer.length

        // функции для разных типов кодирования чисел
        let readInt64   : () => bigint
        let readStingLength: () => int
        let readArrayLength: () => int
        const readers: ((name?: string) => any)[] = []

        const header = [file_buffer.readByte(), file_buffer.readByte(), file_buffer.readByte(), file_buffer.readByte()]
        const has_bedrock_level_header = header[1] === 0 && header[2] === 0 && header[3] === 0 // bedrock level.dat header
        const bedrockHeaderLength = has_bedrock_level_header ? 8 : 0
        const formats = (this.cookie.format && [this.cookie.format]) ??
            (has_bedrock_level_header ? ['little'] : ['big', 'little', 'littleVarint'])
        // пытаемся прочесть в разных форматах
        for(const format of formats) {
            this.cookie.format = format
            // настроить функции чтения
            file_buffer.little_endian = format !== 'big'
            readStingLength = () => file_buffer.readInt16()
            readArrayLength = () => file_buffer.readInt32()
            if (format === 'littleVarint') {
                // Этот случай не тестировался и почти наверняка не работет.
                // Если найдется такая схематика - можно будет на ней отладить.
                readInt64 = readSignedVarLong
                readStingLength = readSignedVarInt
                readArrayLength = readSignedVarInt
            }
            // типы тэгов: https://minecraft.fandom.com/wiki/NBT_format#TAG_definition
            readers[1] = () => file_buffer.readByte()
            readers[2] = () => file_buffer.readInt16()
            readers[3] = () => file_buffer.readInt32()
            readers[4] = () => file_buffer.readBigInt64()
            readers[5] = () => file_buffer.readFloat32()
            readers[6] = () => file_buffer.readFloat64()
            readers[7] = (name?: string) => { // TAG_Byte_Array
                    const length = readArrayLength()
                    if (name === 'BlockData') {
                        const result = { offset: file_buffer.offset, length }
                        file_buffer.skip(length)
                        return result
                    }
                    const result = new Uint8Array(length)
                    for(let i = 0; i < length; i++) {
                        result[i] = file_buffer.readByte()
                    }
                    return result
                }
            readers[8] = readString
            readers[9] = () => {    // TAG_List
                    const list_tag_type = file_buffer.readByte()
                    const list_length = readArrayLength()
                    const result = new Array(list_length)
                    for(let i = 0; i < list_length; i++) {
                        result[i] = readTag(list_tag_type)
                    }
                    return result
                }
            readers[10] = () => {   // TAG_Compound
                    const result = {}
                    let sub_tag_type: int
                    while(sub_tag_type = file_buffer.readByte()) {
                        const name = readString()
                        result[name] = readTag(sub_tag_type, name)
                    }
                    return result
                }
            readers[11] = () => {   // TAG_Int_Array
                    const length = readArrayLength()
                    const result = new Array(length)
                    for(let i = 0; i < length; i++) {
                        result[i] = file_buffer.readInt32()
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
                file_buffer.setOffset(bedrockHeaderLength)
                while (file_buffer.offset !== file_buffer.size) {
                    const tag_type = file_buffer.readByte()
                    if (tag_type === 0) {
                        break
                    }
                    const name = readString()
                    result[name] = readTag(tag_type, name)
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