import fs from 'fs';
import zlib from 'zlib';
import {promisify} from "util";
import stream from "node:stream";

const pipelineAsync = promisify(stream.pipeline)
const finishedAsync = promisify(stream.finished)

const FILE_CHUNK_SIZE               = 32768         // какими кусками читается файл, не загруженый целиком
const DEFAULT_MAX_MEMORY_FILE_SIZE  = 50 * 1000000 // какой максимальной файл загружается в память целиком (по умолчанию)

/**
 * Описывает как осуществляется доступ к файлу через {@link FileBuffer}, в том какой создан временный файл и
 * какой порядок байт. Используется чтобы при повторном откритии чтобы открыть точно таким же образом как перый раз,
 * быстрее, и проверить что файл тот же.
 *
 * Пользователь не должен заполнять эту структуру и не должен знать что в ней, только передать ее
 * в тот же класс при следующем открытии того же файла. Поэтому называется cookie.
 */
export type TFileBufferCookie = {
    fileSize        ? : int     // размер неупаковынных даных
    zipped          ? : boolean
    // время создания/изменения временного файла, если он есть
    tmpFileCtimeMs  ? : number
    tmpFileMtimeMs  ? : number
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

    private _offset      : int = 0   // текущая позиция
    /** Порядок байт при чтении многобайтовых числе. Вызывающий может его ментяь. Не сохоаняется в {@link TFileBufferCookie} */
    littleEndian        = false

    // открытый сейчас файл, из которого чиаем частями
    private file        : number | null = null
    private usingTemporaryFileName? : string | null

    // загруженная сейчас в памать порция файла, или весь файл
    private buffer      : Buffer
    private dataView    : DataView
    private start       : int = 0
    private end         : int = 0   // не включительно

    private utf8decoder = new TextDecoder('utf-8')

    /**
     * Открывает файл для чтения.
     * Файл может быть сжатым zlib или нет.
     * Если размер файла не превышает {@link maxMemoryFileSize}, он считывается в память полностью.
     * Иначе - читается частями по мере необходимости. Если в память не помещается содержимое сжатого фалйла,
     * создает временный файл {@link temporaryFileName}
     * @param cookie - сохраняет информацию о том, как был открыт файл, был ли создан временный файл, см. {@link TFileBufferCookie}.
     */
    async open(fileName: string, temporaryFileName: string, cookie: TFileBufferCookie = {}, maxMemoryFileSize = DEFAULT_MAX_MEMORY_FILE_SIZE): Promise<void> {
        if (this.buffer) {
            throw "re-opening isn't supported"
        }
        this.cookie = cookie

        // если открываем файл первый раз - оценить сжатость и размер
        if (cookie.fileSize == null) {
            // проверить сжатый ли файл
            let header: Buffer
            await finishedAsync(
                fs.createReadStream(fileName, {start: 0, end: 2})
                    .on('data', (buf: Buffer) => { header = buf })
            )
            if (header[0] === 0x1f && header[1] === 0x8b) { // если сжатый
                cookie.zipped = true
                cookie.fileSize = 0
                // Прочитать и распаковать чтобы узнать несжатый размер
                await pipelineAsync(
                    fs.createReadStream(fileName),
                    zlib.createGunzip().on('data', (chunk: Buffer) => {
                        cookie.fileSize += chunk.length
                    })
                )
            } else {
                cookie.fileSize = (await fs.promises.stat(fileName)).size
            }
        }

        if (cookie.fileSize > maxMemoryFileSize) {

            if (cookie.zipped) { // надо использовать временный файл
                let tmpFileExists = false
                // проверить если он уже существует и не менялся с прошлого раза
                if (cookie.tmpFileCtimeMs != null) {
                    let stat = await fs.promises.stat(temporaryFileName).catch(() => null)
                    tmpFileExists = stat?.size === cookie.fileSize &&
                        stat?.ctimeMs === cookie.tmpFileCtimeMs &&
                        stat?.mtimeMs === cookie.tmpFileMtimeMs
                }
                // если нет - создать
                if (!tmpFileExists) {
                    await pipelineAsync(
                        fs.createReadStream(fileName),
                        zlib.createGunzip(),
                        fs.createWriteStream(temporaryFileName)
                    ).catch(async (err) => {
                        await fs.promises.unlink(temporaryFileName).catch(() => null)
                        throw err
                    })
                    const stat = await fs.promises.stat(temporaryFileName)
                    cookie.tmpFileCtimeMs = stat.ctimeMs
                    cookie.tmpFileMtimeMs = stat.mtimeMs
                }
                // теперь используем временный файл как исходный несжатый
                fileName = temporaryFileName
                this.usingTemporaryFileName = fileName  // запомнить чтобы удалить файл в конце
            }

            // подготовить работу с файлом с диска
            const fileSize = (await fs.promises.stat(fileName)).size
            if (fileSize !== cookie.fileSize) {
                throw 'this.fileSize !== cookie.size'
            }
            this.file       = fs.openSync(fileName, 'r')
            this.buffer     = Buffer.alloc(FILE_CHUNK_SIZE)
            this.dataView   = new DataView(this.buffer.buffer)

        } else { // файл небольшой, можно целиком прочесть в память

            // выделить память
            this.buffer     = Buffer.alloc(cookie.fileSize)
            this.dataView   = new DataView(this.buffer.buffer)

            // прочитать в память
            const onData = (chunk: Buffer) => {
                chunk.copy(this.buffer, this.end)
                this.end += chunk.length
                if (this.end > cookie.fileSize) {
                    throw 'this.end > cookie.size'
                }
            }
            if (cookie.zipped) {
                await pipelineAsync(
                    fs.createReadStream(fileName),
                    zlib.createGunzip().on('data', onData)
                )
            } else {
                await finishedAsync(
                    fs.createReadStream(fileName).on('data', onData)
                )
            }
            if (this.end !== cookie.fileSize) {
                throw 'this.end !== cookie.size'
            }
        }
    }

    async close() {
        if (this.file) {
            fs.closeSync(this.file)
            if (this.usingTemporaryFileName) {
                await fs.promises.unlink(this.usingTemporaryFileName).catch(() => null)
            }
            this.file = null
        }
    }

    get size(): int { return this.cookie.fileSize }

    /** Текущее смещение относительно начала файла в байтах */
    get offset(): int { return this._offset }

    /**
     * Устанавливает текущее смещение относительно начала файла в байтах.
     * @param readLength - необязательный параметр для оптимизации чтения небольших кусков.
     *   Если задан, то будет прочитано не больше байт, чем это значение а не {@link FILE_CHUNK_SIZE}.
     */
    setOffset(offset: int, fileChunkSize?: int): void {
        this._offset = offset
        if (this.file && (offset < this.start || offset >= this.end)) {
            fileChunkSize = Math.min(fileChunkSize ?? FILE_CHUNK_SIZE, FILE_CHUNK_SIZE)
            this.read(1, fileChunkSize)
        }
    }

    readByte(): float {
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
        return this.dataView.getInt16(_offset - this.start, this.littleEndian)
    }

    readInt32(): float {
        const {_offset} = this
        if (_offset + 4 > this.end) {
            this.read(4)
        }
        this._offset += 4
        return this.dataView.getInt32(_offset - this.start, this.littleEndian)
    }

    readBigInt64(): bigint {
        const {_offset} = this
        if (_offset + 8 > this.end) {
            this.read(8)
        }
        this._offset += 8
        return this.dataView.getBigInt64(_offset - this.start, this.littleEndian)
    }

    readFloat32(): float {
        const {_offset} = this
        if (_offset + 4 > this.end) {
            this.read(4)
        }
        this._offset += 4
        return this.dataView.getFloat32(_offset - this.start, this.littleEndian)
    }

    readFloat64(): float {
        const {_offset} = this
        if (_offset + 8 > this.end) {
            this.read(8)
        }
        this._offset += 8
        return this.dataView.getFloat64(_offset - this.start, this.littleEndian)
    }

    readString(lengthBytes: int): string {
        const {_offset} = this
        if (_offset + lengthBytes > this.end) {
            this.read(lengthBytes)
        }
        this._offset += lengthBytes
        const dataView = new DataView(this.buffer.buffer, _offset - this.start, lengthBytes)
        return this.utf8decoder.decode(dataView)
    }
    
    skip(lengthBytes: int): void {
        this._offset += lengthBytes
        if (this._offset > this.cookie.fileSize) {
            throw 'buffer_underflow'
        }
    }

    private read(length: int, chunkSize: int = FILE_CHUNK_SIZE): void {
        const {file, _offset} = this
        const {fileSize} = this.cookie
        if (file == null || _offset + length > fileSize) {
            this.close()
            throw 'buffer_underflow'
        }
        length = Math.min(fileSize - _offset, Math.max(length, chunkSize))
        const bytesRead = fs.readSync(file, this.buffer, 0, length, _offset)
        if (bytesRead !== length) {
            this.close()
            throw 'bytesRead !== length'
        }
        this.start = _offset
        this.end = _offset + length
    }
}