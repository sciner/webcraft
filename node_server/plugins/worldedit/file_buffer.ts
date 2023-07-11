import fs from 'fs';
import zlib from 'zlib';
import {promisify} from "util";
import stream from "node:stream";

const pipelineAsync = promisify(stream.pipeline)
const finishedAsync = promisify(stream.finished)

const FILE_CHUNK_SIZE               = 32768         // какими кусками читается файл, не загруженый целиком

/**
 * Описывает как осуществляется доступ к файлу через {@link FileBuffer}, в том какой создан временный файл и
 * какой порядок байт. Используется чтобы при повторном откритии чтобы открыть точно таким же образом как перый раз,
 * быстрее, и проверить что файл тот же.
 *
 * Пользователь не должен заполнять эту структуру и не должен знать что в ней, только передать ее
 * в тот же класс при следующем открытии того же файла. Поэтому называется cookie.
 */
export type TFileBufferCookie = {
    file_size        ? : int     // размер неупаковынных даных
    zipped          ? : boolean
    // время создания/изменения временного файла, если он есть
    tmp_file_ctimeMs  ? : number
    tmp_file_mtimeMs  ? : number
}

/**
 * Обеспечивает случайный и последовательный доступ к двоичному файлу.
 * Возможности:
 * - может загружать файл целиком, или чиать с диска по мере надобности
 * - поддерживает чтение из запакованных gzip файлов (если распакованный не помещается в память - создает временный файл)
 * Автоматически определяет как открывать файл.
 *
 * Читает из файла синхронно - чтобы не создавать Promise на каждые прочитанные пару байт.
 * Это подходящее решение для воркреа у которого нет других задач, но не для основного потока.
 */
export class FileBuffer {

    private cookie: TFileBufferCookie

    private _offset     : int = 0   // текущая позиция
    /** Порядок байт при чтении многобайтовых числе. Вызывающий может его ментяь. Не сохоаняется в {@link TFileBufferCookie} */
    little_endian       = false

    // открытый сейчас файл, из которого чиаем частями
    private file        : number | null = null
    private using_temporary_file_name? : string | null

    // загруженная сейчас в памать порция файла, или весь файл
    private buffer      : Buffer
    private dataView    : DataView
    private start       : int = 0
    private end         : int = 0   // не включительно

    private utf8decoder = new TextDecoder('utf-8')

    /**
     * Открывает файл для чтения.
     * Файл может быть сжатым zlib или нет.
     * Если размер файла не превышает {@link max_memory_file_size}, он считывается в память полностью.
     * Иначе - читается частями по мере необходимости. Если в память не помещается содержимое сжатого фалйла,
     * создает временный файл {@link temporary_file_name}
     * @param cookie - сохраняет информацию о том, как был открыт файл, был ли создан временный файл, см. {@link TFileBufferCookie}.
     */
    async open(file_name: string, temporary_file_name: string, max_memory_file_size: int, cookie: TFileBufferCookie = {}): Promise<void> {
        if (this.buffer) {
            throw "re-opening isn't supported"
        }
        this.cookie = cookie

        // если открываем файл первый раз - оценить сжатость и размер
        if (cookie.file_size == null) {
            // проверить сжатый ли файл
            let header: Buffer
            await finishedAsync(
                fs.createReadStream(file_name, {start: 0, end: 2})
                    .on('data', (buf: Buffer) => { header = buf })
            )
            if (header[0] === 0x1f && header[1] === 0x8b) { // если сжатый
                cookie.zipped = true
                cookie.file_size = 0
                // Прочитать и распаковать чтобы узнать несжатый размер
                await pipelineAsync(
                    fs.createReadStream(file_name),
                    zlib.createGunzip().on('data', (chunk: Buffer) => {
                        cookie.file_size += chunk.length
                    })
                )
            } else {
                cookie.file_size = (await fs.promises.stat(file_name)).size
            }
        }

        if (cookie.file_size > max_memory_file_size) {

            if (cookie.zipped) { // надо использовать временный файл
                let tmpFileExists = false
                // проверить если он уже существует и не менялся с прошлого раза
                if (cookie.tmp_file_ctimeMs != null) {
                    let stat = await fs.promises.stat(temporary_file_name).catch(() => null)
                    tmpFileExists = stat?.size === cookie.file_size &&
                        stat?.ctimeMs === cookie.tmp_file_ctimeMs &&
                        stat?.mtimeMs === cookie.tmp_file_mtimeMs
                }
                // если нет - создать
                if (!tmpFileExists) {
                    await pipelineAsync(
                        fs.createReadStream(file_name),
                        zlib.createGunzip(),
                        fs.createWriteStream(temporary_file_name)
                    ).catch(async (err) => {
                        await fs.promises.unlink(temporary_file_name).catch(() => null)
                        throw err
                    })
                    const stat = await fs.promises.stat(temporary_file_name)
                    cookie.tmp_file_ctimeMs = stat.ctimeMs
                    cookie.tmp_file_mtimeMs = stat.mtimeMs
                }
                // теперь используем временный файл как исходный несжатый
                file_name = temporary_file_name
                this.using_temporary_file_name = file_name  // запомнить чтобы удалить файл в конце
            }

            // подготовить работу с файлом с диска
            const fileSize = (await fs.promises.stat(file_name)).size
            if (fileSize !== cookie.file_size) {
                throw 'this.fileSize !== cookie.file_size'
            }
            this.file       = fs.openSync(file_name, 'r')
            this.buffer     = Buffer.alloc(FILE_CHUNK_SIZE)
            this.dataView   = new DataView(this.buffer.buffer)

        } else { // файл небольшой, можно целиком прочесть в память

            // выделить память
            this.buffer     = Buffer.alloc(cookie.file_size)
            this.dataView   = new DataView(this.buffer.buffer)

            // прочитать в память
            const onData = (chunk: Buffer) => {
                chunk.copy(this.buffer, this.end)
                this.end += chunk.length
                if (this.end > cookie.file_size) {
                    throw 'this.end > cookie.file_size'
                }
            }
            if (cookie.zipped) {
                await pipelineAsync(
                    fs.createReadStream(file_name),
                    zlib.createGunzip().on('data', onData)
                )
            } else {
                await finishedAsync(
                    fs.createReadStream(file_name).on('data', onData)
                )
            }
            if (this.end !== cookie.file_size) {
                throw 'this.end !== cookie.file_size'
            }
        }
    }

    async close() {
        if (this.file) {
            fs.closeSync(this.file)
            if (this.using_temporary_file_name) {
                await fs.promises.unlink(this.using_temporary_file_name).catch(() => null)
            }
            this.file = null
        }
    }

    get size(): int { return this.cookie.file_size }

    /** Текущее смещение относительно начала файла в байтах */
    get offset(): int { return this._offset }

    /**
     * Устанавливает текущее смещение относительно начала файла в байтах.
     * @param readLength - необязательный параметр для оптимизации чтения небольших кусков.
     *   Если задан, то будет прочитано не больше байт, чем это значение а не {@link FILE_CHUNK_SIZE}.
     */
    setOffset(offset: int, file_chunk_size?: int): void {
        this._offset = offset
        if (this.file && (offset < this.start || offset >= this.end)) {
            file_chunk_size = Math.min(file_chunk_size ?? FILE_CHUNK_SIZE, FILE_CHUNK_SIZE)
            this.read(1, file_chunk_size)
        }
    }

    readInt8(): float {
        const {_offset} = this
        if (_offset >= this.end) {
            this.read(1)
        }
        this._offset++
        return this.dataView.getInt8(_offset - this.start)
    }

    readInt16(): float {
        const {_offset} = this
        if (_offset + 2 > this.end) {
            this.read(2)
        }
        this._offset += 2
        return this.dataView.getInt16(_offset - this.start, this.little_endian)
    }

    readInt32(): float {
        const {_offset} = this
        if (_offset + 4 > this.end) {
            this.read(4)
        }
        this._offset += 4
        return this.dataView.getInt32(_offset - this.start, this.little_endian)
    }

    readBigInt64(): bigint {
        const {_offset} = this
        if (_offset + 8 > this.end) {
            this.read(8)
        }
        this._offset += 8
        return this.dataView.getBigInt64(_offset - this.start, this.little_endian)
    }

    readFloat32(): float {
        const {_offset} = this
        if (_offset + 4 > this.end) {
            this.read(4)
        }
        this._offset += 4
        return this.dataView.getFloat32(_offset - this.start, this.little_endian)
    }

    readFloat64(): float {
        const {_offset} = this
        if (_offset + 8 > this.end) {
            this.read(8)
        }
        this._offset += 8
        return this.dataView.getFloat64(_offset - this.start, this.little_endian)
    }

    readString(length_bytes: int): string {
        const {_offset} = this
        if (_offset + length_bytes > this.end) {
            this.read(length_bytes)
        }
        this._offset += length_bytes
        const dataView = new DataView(this.buffer.buffer, _offset - this.start, length_bytes)
        return this.utf8decoder.decode(dataView)
    }

    skip(length_bytes: int): void {
        this._offset += length_bytes
        if (this._offset > this.cookie.file_size) {
            throw 'buffer_underflow'
        }
    }

    /** Напрямую читает {@link length} байт с позиции {@link offset}. Не меняет {@link this.offset} */
    getBytes(dst: Uint8Array, offset: int, length: int): void {
        const {file} = this
        const bytesRead = file
            ? fs.readSync(file, dst, 0, length, offset)
            : this.buffer.copy(dst, 0, offset, offset + length)
        if (bytesRead !== length) {
            this.close()
            throw 'buffer_underflow'
        }
    }

    private read(length: int, chunk_size: int = FILE_CHUNK_SIZE): void {
        const {file, _offset} = this
        const {file_size} = this.cookie
        if (file == null || _offset + length > file_size) {
            this.close()
            throw 'buffer_underflow'
        }
        length = Math.min(file_size - _offset, Math.max(length, chunk_size))
        const bytesRead = fs.readSync(file, this.buffer, 0, length, _offset)
        if (bytesRead !== length) {
            this.close()
            throw 'bytesRead !== length'
        }
        this.start = _offset
        this.end = _offset + length
    }
}