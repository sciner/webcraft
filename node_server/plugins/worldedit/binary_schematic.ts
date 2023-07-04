import fs from 'fs';
import {Vector} from "@client/helpers/vector.js";
import {AABB} from "@client/core/AABB.js";
import { Schematic } from 'madcraft-schematic-reader';
import {FileBuffer, TFileBufferCookie} from "./file_buffer.js";
import {ArrayHelpers} from "@client/helpers/array_helpers.js";

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

type TByteArrayDescriptor = {
    offset: int
    length: int
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
    private tmp_iteration_entry: [Vector, int] = [new Vector(), 0]
    count_by_palette: int[] // число блоков каждого типа из палитры в мире

    // ========== данные для быстрого доступа к упакованным блокам в BlockData ==========

    /** i-й элемент - номер байта, с которого начинается (i * BLOCKS_PER_OFFSET)-й блок */
    private offsets: Uint32Array
    /**
     * i-й элемент - смещение в байтах блока (i * BLOCKS_PER_INCREMENTAL_OFFSET) относительно блока
     * ((i - 1) * BLOCKS_PER_INCREMENTAL_OFFSET)
     */
    private incremental_offsets: Uint8Array
    private strideZ: int
    private strideY: int

    // ===================== данные для чтения блоков формата 1.13 ======================

    private to_palette?: Map<int, int>   // ключ = (id_блока << 8) + данные, значение - индекс в палитре
    // сохраненное местоположение массивов с такими же именами в бинарном файле
    private Blocks: TByteArrayDescriptor
    private Data: TByteArrayDescriptor
    private AddBlocks: TByteArrayDescriptor
    // временные массивы, используются при чтении
    private tmp_Blocks?: Uint8Array
    private tmp_Data?: Uint8Array
    private tmp_AddBlocks?: Uint8Array

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
                const volume = nbt.Width * nbt.Height * nbt.Length

                if (nbt.BlockData) {    // формат с палитрой
                    const palette_max = ArrayHelpers.max(Object.values(nbt.Palette))
                    const count_by_palette = this.count_by_palette = new Array(palette_max + 1).fill(0)

                    // вычислить смещения в байтах для некоторых упакованных блоков для быстрого доступа по координатам
                    const {offset, length} = nbt.BlockData
                    file_buffer.setOffset(offset)
                    let prev_offset = 0
                    const end_offset = offset + length
                    this.offsets = new Uint32Array(Math.ceil(length / BLOCKS_PER_OFFSET))
                    this.incremental_offsets = new Uint8Array(Math.ceil(length / BLOCKS_PER_INCREMENTAL_OFFSET))
                    let block_index = 0
                    let incremental_offset_index = 0 // индекс в массиве incremental_offsets

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
                                // пропустить 1 упакованный блок. Пвтор кода, см. getBlocks(), readSignedVarInt
                                let byte = file_buffer.readInt8()
                                let value = byte & 127
                                let varint_length = 0   // на 7 меньше длины числа битах
                                while ((byte & 128) !== 0) {
                                    byte = file_buffer.readInt8()
                                    varint_length += 7
                                    value |= (byte & 127) << varint_length
                                    if (varint_length > (31 - 7)) {
                                        throw new Error('VarInt is too big (probably corrupted data)')
                                    }
                                }
                                count_by_palette[value]++
                                block_index++
                            }
                        }
                    }
                    if (file_buffer.offset !== end_offset) {
                        throw new Error("BlockData length doesn't match")
                    }

                    nbt.BlockData = [] // передать в sponge пустой массив, чтобы они не тратили время на него
                    // постпроцессинг тэгов через sponge (или mcedit - но мы ожидаем что для такого формата сработает sponge)
                    this.schematic = Schematic.parse(nbt)
                } else if (nbt.Blocks && nbt.Data) { // формат 1.13, без палитры.

                    // Прочесть все блоки и собрать уникальные комабинации (id, data) в массив фейк блоков, где каждый уникальный
                    // блок встаечается 1 раз. Потом передать этот массив в плагин mcedit, чтобы он построил палитру.
                    // Код чтения основан наа коде из mceditSchematic.js

                    nbt.AddBlocks ??= nbt.Add
                    const {Blocks, Data, AddBlocks} = nbt
                    const unique_blocks = new Map<int, int>() // ключи - упакованные блоки; значения - индексы в массиве фейк блоков

                    // читаемые куски файла
                    const max_chunk_size= 1 << 16   // размер куска данных обрабатываемого за раз; не имеет отношения к размеру игрового Chunk
                    const blocks        = new Uint8Array(max_chunk_size)
                    const data          = new Uint8Array(max_chunk_size)
                    const add_blocks    = AddBlocks && new Uint8Array(max_chunk_size / 2)

                    // массив уникальных блоков, который мы передадим в mcedit
                    const fake_blocks       : int[] = []
                    const fake_data         : int[] = []
                    const fake_add_blocks   : int[] | undefined = AddBlocks && []
                    const count_by_unique_index: int[] = []

                    // по каждому куску 2-х или 3-х массивов
                    for(let chunk_offset = 0; chunk_offset < Blocks.length; chunk_offset += max_chunk_size) {
                        // прочитать куски массивов блоков
                        const chunk_size = Math.min(max_chunk_size, Blocks.length - chunk_offset)
                        file_buffer.getBytes(blocks, Blocks.offset + chunk_offset, chunk_size)
                        file_buffer.getBytes(data, Data.offset + chunk_offset, chunk_size)
                        if (add_blocks) {
                            file_buffer.getBytes(add_blocks, AddBlocks.offset + chunk_offset, (chunk_size + 1) / 2)
                        }
                        // для каждого блока из этого куска
                        for(let i = 0; i < chunk_size; i++) {
                            // повтор кода - см. getBlocks()
                            let id = blocks[i]
                            if (add_blocks) {
                                id += (i & 1)
                                    ? (add_blocks[i >> 1] & 0x0F) << 8
                                    : (add_blocks[i >> 1] & 0xF0) << 4
                            }
                            const key = (id << 8) | data[i]
                            const unique_index = unique_blocks.get(key)
                            if (unique_index == null) {
                                const fake_index = fake_blocks.length
                                unique_blocks.set(key, fake_index)
                                fake_blocks.push(blocks[i])
                                fake_data.push(data[i])
                                if (add_blocks) {
                                    const added = (i & 1)
                                        ? (add_blocks[i >> 1] & 0x0F)
                                        : (add_blocks[i >> 1] & 0xF0) >> 4
                                    const fake_added = (fake_index & 1)
                                        ? added
                                        : added << 4
                                    fake_add_blocks[fake_index >> 1] = (fake_add_blocks[fake_index >> 1] ?? 0) | fake_added
                                }
                                count_by_unique_index.push(1)
                            } else {
                                count_by_unique_index[unique_index]++
                            }
                        }
                    }
                    // запомнить где расположены массивы в схематике - это нам понадобится чтобы потом читать блоки
                    this.Blocks     = nbt.Blocks
                    this.Data       = nbt.Data
                    this.AddBlocks  = nbt.AddBlocks
                    // передать в mcedit фейковые массивы, содержащие уникальные блоки
                    nbt.Blocks      = fake_blocks
                    nbt.Data        = fake_data
                    nbt.AddBlocks   = fake_add_blocks

                    // постпроцессинг тэгов через mcedit (sponge попробует запуститься первым, но будет исключение)
                    this.schematic = Schematic.parse(nbt)

                    // найти соответствие исходных блоков индексам палитре, посчитать число блоков каждого типа в палитре
                    const count_by_palette = this.count_by_palette = new Array(this.schematic.palette.length).fill(0)
                    const unique_to_palette = this.schematic.blocks // индекс = уникальный индекс. Значение = номер в палитре
                    const to_palette = new Map()
                    for(const [key, unique_index] of unique_blocks) {
                        const palette_index = unique_to_palette[unique_index]
                        to_palette.set(key, palette_index)
                        count_by_palette[palette_index] = count_by_unique_index[unique_index]
                    }
                    this.to_palette = to_palette
                } else {
                    throw 'no expected block tags found'
                }

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
            const count_by_palette = this.count_by_palette = new Array(this.schematic.palette.length).fill(0)
            for(const v of this.schematic.blocks) {
                count_by_palette[v]++
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
        return this.file_buffer?.close()
    }

    /**
     * Возвращает все блоки из указанной обалсти.
     * @param aabb - читаемая часть схематики в СК схематики (не добавляет автоматически offset из Metadata).
     * @return координаты в СК мира, номера блоков в палитре
     */
    *getBlocks(aabb: AABB = this.aabb): IterableIterator<[pos: Vector, paletteIndex: int]> {
        const {strideZ, strideY, tmp_iteration_entry, size, to_palette} = this
        const vec = tmp_iteration_entry[0]
        const {x_min, x_max} = aabb
        if (!this.aabb.containsAABB(aabb)) {
            throw 'requested AABB is outside the schematic'
        }
        // отразить по z - перевести в систему координат схематики
        const z_min = size.z - aabb.z_max
        const z_max = size.z - aabb.z_min

        // если блоки не в бинароном формате
        if (this.cookie.use_external_parser) {
            const {blocks} = this.schematic
            for(let y = aabb.y_min; y < aabb.y_max; y++) {
                vec.y = y
                for(let z = z_min; z < z_max; z++) {
                    vec.z = (size.z - 1 - z) // отразить по z - перевести в систему координат madcraft
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
        
        // если формат 1.13
        if (to_palette) {
            const {Blocks, Data, AddBlocks, to_palette, file_buffer} = this
            // выделить память для временных массивов, если нужно
            const line_length = x_max - x_min + 1 // +1 - т.к. иногда мы читаем на 1 байт больше в начале 
            if (this.tmp_Blocks?.length ?? 0 < line_length) {
                const len = line_length * 2
                this.tmp_Blocks     = new Uint8Array(len)
                this.tmp_Data       = new Uint8Array(len)
                this.tmp_AddBlocks  = AddBlocks && new Uint8Array((len + 1) / 2)
            }
            const {tmp_Blocks, tmp_Data, tmp_AddBlocks} = this
                
            // цкилы по (y, z) - началу непрерывной строки блоков
            for(let y = aabb.y_min; y < aabb.y_max; y++) {
                vec.y = y
                for(let z = z_min; z < z_max; z++) {
                    vec.z = (size.z - 1 - z) // отразить по z - перевести в систему координат madcraft
                    
                    let line_length = x_max - x_min
                    let offset = y * strideY + z * strideZ + x_min // индекс 0-го блока строки
                    // сделать offset четным, чтобы AddBlocks начинались с целого байта
                    let index = offset % 2    // индекс первого блока блока строки во временных массивах
                    offset -= index
                    line_length += index
                    
                    // прочитать строки данных во временные массивы
                    file_buffer.getBytes(tmp_Blocks, Blocks.offset + offset, line_length)
                    file_buffer.getBytes(tmp_Data, Data.offset + offset, line_length)
                    if (tmp_AddBlocks) {
                        file_buffer.getBytes(tmp_AddBlocks, AddBlocks.offset + offset, (line_length + 1) / 2)
                    }
                    
                    // по всем блокам строки
                    for(let x = x_min; x < x_max; x++) {
                        vec.x = x
                        // собрать значение блока из разных массивов. Повтор кода - см. в open()
                        let id = tmp_Blocks[index]
                        if (tmp_AddBlocks) {
                            id += (index & 1)
                                ? (tmp_AddBlocks[index >> 1] & 0x0F) << 8
                                : (tmp_AddBlocks[index >> 1] & 0xF0) << 4
                        }
                        const key = (id << 8) | tmp_Data[index]
                        const value = to_palette.get(key)
                        if (value == null) {
                            throw new Error()
                        }
                        // выдать результат
                        tmp_iteration_entry[1] = value
                        yield tmp_iteration_entry
                        index++
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
                vec.z = (size.z - 1 - z) // отразить по z - перевести в систему координат madcraft

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
                    while ((file_buffer.readInt8() & 128) !== 0) {
                        // ничего
                    }
                }

                // по всем блокам строки
                for(let x = x_min; x < x_max; x++) {
                    vec.x = x
                    // распаковать значение блока. Повтор кода - см. в open()
                    let byte = file_buffer.readInt8()
                    let value = byte & 127
                    let varint_length = 0   // на 7 меньше длины числа битах
                    while ((byte & 128) !== 0) {
                        byte = file_buffer.readInt8()
                        varint_length += 7
                        value |= (byte & 127) << varint_length
                    }
                    // выдать результат
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
                b = file_buffer.readInt8()
                result |= (b & 127) << varint_length
                varint_length += 7
                if (varint_length > 31) {
                    throw new Error('VarInt is too big (probably corrupted data)')
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

        const header = [file_buffer.readInt8(), file_buffer.readInt8(), file_buffer.readInt8(), file_buffer.readInt8()]
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
            readers[1] = () => file_buffer.readInt8()
            readers[2] = () => file_buffer.readInt16()
            readers[3] = () => file_buffer.readInt32()
            readers[4] = () => file_buffer.readBigInt64()
            readers[5] = () => file_buffer.readFloat32()
            readers[6] = () => file_buffer.readFloat64()
            readers[7] = (name?: string) => { // TAG_Byte_Array
                    const length = readArrayLength()
                    if (name === 'BlockData' || name === 'Blocks' || name === 'Data' || name === 'AddBlocks' || name === 'Add') {
                        const result: TByteArrayDescriptor = { offset: file_buffer.offset, length }
                        file_buffer.skip(length)
                        return result
                    }
                    const result = new Uint8Array(length)
                    for(let i = 0; i < length; i++) {
                        result[i] = file_buffer.readInt8()
                    }
                    return result
                }
            readers[8] = readString
            readers[9] = () => {    // TAG_List
                    const list_tag_type = file_buffer.readInt8()
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
                    while(sub_tag_type = file_buffer.readInt8()) {
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
                    const tag_type = file_buffer.readInt8()
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