import {Mth} from "@client/helpers/mth.js";
import type {ServerChunk} from "../../server_chunk.js";
import {Vector} from "@client/helpers/vector.js";
import {TBlock} from "@client/typed_blocks3.js";
import {FAST_RANDOM_TICKERS_PERCENT} from "@client/constant.js";
import {WorldAction} from "@client/world_action.js";
import {CHUNK_STATE} from "@client/chunk_const.js";
import {RANDOM_TICK_SPEED_CHUNK_SIZE} from "../../game_rule.js";

const _rnd_check_pos = new Vector()
const tmpRandomTickerTBlock = new TBlock()

/** Хранит число и/или индексы случайных тикеров одного чанка. */
export class RandomTickingBlocks {

    private static EMPTY_INDEX = 0xffff

    private chunk: ServerChunk
    private count: int // число тикающих блоков

    /** Индекс этого чанка в {@link ServerChunkManager.random_chunks}, если он там есть */
    private random_chunk_index: int | null = null

    /**
     * Хеш-таблица блоков. Не null только если их не больше чем {@link maxCount}.
     * Головы списков - индексы в {@link arr}.
     * Таблицы могут стать не null только 1 раз - в конструкторе
     */
    private heads: Uint16Array | null = null
    /** Пары [значение, следующий_индекс_в_arr]. Заняты первые {@link count} элементов без дыр */
    private arr: Uint16Array | null = null
    private maxCount: int  // максимальное число, для которого хранятся позиции

    /** Сюда добавляются действия тикеров. Это действие будет добавлено в мир и пересоздано как только в него добавятся блоки. */
    private static actions = new WorldAction(null, null, false, false)

    constructor(chunk: ServerChunk, scannedTickers: TScannedTickers) {
        this.chunk = chunk
        const {CHUNK_SIZE} = chunk.chunkManager.grid.math
        if (CHUNK_SIZE >= 0xffff) {
            throw Error() // размер слишком большой для 16-ти битных индексов + пустое значение
        }
        this.maxCount = Math.round(CHUNK_SIZE * FAST_RANDOM_TICKERS_PERCENT)
        if (scannedTickers.randomTickerFlatIndices && scannedTickers.randomTickersCount <= this.maxCount) {
            this.createTable(scannedTickers.randomTickersCount * 1.05 + 10) // маленький запас для новых блоков (если надо - выделится еще)
            for(const flatIndex of scannedTickers.randomTickerFlatIndices) {
                this.add(flatIndex)
            }
        } else {
            this.count = scannedTickers.randomTickersCount
            this.updateRandomChunks()
        }
    }
    
    /** Добавляет или удаляет этот чанк из {@link ServerChunkManager.random_chunks} */
    updateRandomChunks(): void {
        const {chunk, random_chunk_index} = this
        const {random_chunks} = chunk.chunkManager
        if (chunk.load_state === CHUNK_STATE.READY && this.count > 0) {
            if (random_chunk_index == null) {   // если надо добавить в random_chunks
                this.random_chunk_index = random_chunks.length 
                random_chunks.push(this)
            }
        } else {
            if (random_chunk_index != null) {   // если надо удалить из random_chunks
                if (random_chunk_index != random_chunks.length - 1) { // перенести последний чанк на место этого
                    random_chunks[random_chunk_index] = random_chunks.pop()
                    random_chunks[random_chunk_index].random_chunk_index = random_chunk_index
                } else {
                    random_chunks.pop() // просто удалить этот чанк
                }
                this.random_chunk_index = null
            }
        }   
    }

    tick(world_light: int, check_count: float): void {

        const tickBlock = (flatIndex: int) => {
            fromFlatChunkIndex(_rnd_check_pos, flatIndex)
            const tblock = chunk.tblocks.get(_rnd_check_pos, tmpRandomTickerTBlock);
            const ticker = block_random_tickers[tblock.id]
            if(ticker) {
                ticker(chunk.world, RandomTickingBlocks.actions, world_light, tblock)
            } else {
                console.error(`No random ticker for block ${tblock.id}`) // такого не долно быть
            }
        }

        const {chunk, count, arr} = this
        const block_random_tickers = chunk.chunkManager.block_random_tickers
        const {fromFlatChunkIndex, CHUNK_SIZE} = chunk.chunkManager.grid.math

        if (this.heads) { // вызываем только для известных блоков
            check_count = Mth.roundRandom(check_count * count / RANDOM_TICK_SPEED_CHUNK_SIZE) // число вызовов пропорционально числу тикеров
            if (!check_count) {
                return
            }
            let index = Mth.randomInt(count) // индекс случайного блока в arr
            for(let i = 0; i < check_count; i++) {
                tickBlock(arr[2 * index])
                index = (index + 100003) % count // добавляем простое число - перебирает индексы без повторения
            }
        } else { // старый метод - вызывем случайно для всех блоков
            check_count = Mth.roundRandom(check_count * CHUNK_SIZE / RANDOM_TICK_SPEED_CHUNK_SIZE) // число вызовов пропорционально размеру чанка
            for (let i = 0; i < check_count; i++) {
                tickBlock(Math.floor(Math.random() * CHUNK_SIZE))
            }
        }

        const actions = RandomTickingBlocks.actions
        if (actions.blocks.list.length) {
            globalThis.modByRandomTickingBlocks = (globalThis.modByRandomTickingBlocks | 0) + actions.blocks.list.length;
            this.chunk.world.actions_queue.add(null, actions)
            RandomTickingBlocks.actions = new WorldAction(null, null, false, false)
        }
    }

    add(flatIndex: int): void {
        let {heads, arr} = this
        const arrIndex = this.count * 2
        this.count++
        if (arrIndex === 0) {
            this.updateRandomChunks()
        }
        if (!heads) { // если нет хеш-таблицы
            return
        }
        // увеличить размер таблицы
        if (this.count > heads.length) {
            if (this.count === this.maxCount) {
                this.heads = null   // освободить память, больше не хранить индексы
                this.arr = null
                return
            }
            // увеличить размер таблицы
            this.createTable(this.count * 1.4 + 10)
            for(let index of heads) { // перенести элементы старой таблицы в новую
                while (index != RandomTickingBlocks.EMPTY_INDEX) {
                    this.add(arr[index])
                    index = arr[index + 1]
                }
            }
            heads   = this.heads
            arr     = this.arr
        }
        // добавили блок
        const head = flatIndex % heads.length
        arr[arrIndex] = flatIndex
        arr[arrIndex + 1] = heads[head]
        heads[head] = arrIndex
    }

    delete(flatIndex: int): void {
        let foundHead: int
        let foundArrIndex: int
        let foundArrPrev: int
        function findFlatIndex(flatIndex: int): boolean {
            foundHead = flatIndex % heads.length
            foundArrPrev = -1
            foundArrIndex = heads[foundHead]
            while (foundArrIndex !== RandomTickingBlocks.EMPTY_INDEX) {
                if (arr[foundArrIndex] === flatIndex) {
                    return true
                }
                foundArrPrev = foundArrIndex
                foundArrIndex = arr[foundArrIndex + 1]
            }
            return false
        }

        const {heads, arr} = this
        this.count--
        if (this.count === 0) {
            this.updateRandomChunks()
        }
        if (!this.heads) { // если нет хеш-таблицы
            return
        }
        // найти удаляемый элемент
        if (!findFlatIndex(flatIndex)) {
            console.error('deletedArrIndex === RandomTickingBlockManager.EMPTY_INDEX')
            this.count++
            this.updateRandomChunks()
            return
        }
        const deletedArrIndex = foundArrIndex
        // удалить его из связанного списка (тот, кто на него ссылался, будет ссылаться на следующий)
        if (foundArrPrev >= 0) {
            arr[foundArrPrev + 1] = arr[foundArrIndex + 1]
        } else {
            heads[foundHead] = arr[foundArrIndex + 1]
        }
        // если это не последний элемент в списке, на его место нужно переместить последний элемент
        const movedArrIndex = this.count * 2
        if (deletedArrIndex !== movedArrIndex) {
            // найти кто указывает на перемещаемый элемент в списке
            if (!findFlatIndex(arr[movedArrIndex])) {
                throw new Error('movedArrIndex === RandomTickingBlockManager.EMPTY_INDEX')
            }
            // переместить элемент с конца на место удаленного
            if (foundArrPrev >= 0) {
                arr[foundArrPrev + 1] = deletedArrIndex
            } else {
                heads[foundHead] = deletedArrIndex
            }
            arr[deletedArrIndex] = arr[movedArrIndex]
            arr[deletedArrIndex + 1] = arr[movedArrIndex + 1]
        }
    }

    private createTable(capacity: number): void {
        capacity = Math.min(this.maxCount, Math.round(capacity))
        this.count = 0
        this.heads = new Uint16Array(capacity).fill(RandomTickingBlocks.EMPTY_INDEX)
        this.arr = new Uint16Array(capacity * 2)
    }
}