import {Vector} from "@client/helpers/vector.js";
import type {ServerWorld} from "../../server_world.js";
import type {TSchematicInfo} from "../chat_worldedit.js";
import {AABB, IAABB} from "@client/core/AABB.js";
import {WorldAction} from "@client/world_action.js";
import type {TBlocksInChunk} from "./schematic_reader.js";
import {VectorCardinalTransformer} from "@client/helpers/vector_cardinal_transformer.js";
import type WorldEdit from "../chat_worldedit.js";

/** Сколько чанков могут одновременно находиться в обработке (в воркере или в WorldActions) */
const MAX_CHUNKS_BEING_PROCESSED = 32
/**
 * Максимальное число грязных блоков в памяти, при котором возможен запрос новых чанков.
 * Больше значение => больше размер JSON в одной транзакции => больше тормозов.
 */
const MAX_DIRTY_BLOCKS = 100 * 1000
/**
 * Максимальное число {@link ChunkDBActor} (т.е. чанков или данных чанков без самих чанков), при котором
 * возможен запрос новых чанков. Это в основном лимитирует потребление памяти.
 */
const MAX_CHUNK_ACTORS = 20 * 1000

const MIN_PROGRESS_MESSAGE_PERCENT = 10 // частые сообщения о прогре не выводтся пока не будет обработано этот % момента прошлого сообщения
const MIN_PROGRESS_MESSAGE_SECONDS = 30 // частые сообщения о прогрессе не выводтся чаще этого времени

// если прошло столько времени, обязательно выводится сообщение о прогрессе вставки, независимо от % выполнения
const MAX_PROGRESS_MESSAGE_SECONDS = 120

/** Состояние процесса вставки схематики в мир, хранящееся в БД */
export type TSchematicJobState = {
    chunksCount : int       // общее число затронутых чанков. Может быть вычислено по pos и size, но хранится отдельным полем для простоты
    consecutiveChunksInserted : int    // все чанки до этого номера включительно вставлены
    /**
     * Некоторые вставленные чанки после {@link consecutiveChunksInserted} с дырами в нумерации.
     * Дыры в нумераии (нарушение порядка вставки) можут быть, например, из-за {@link ServerChunk.pendingWorldActions}.
     * Когда дыры заполнятся, чанки будут удалены из этого списка и увеличится {@link consecutiveChunksInserted}.
     */
    chunksInserted: int[]
}

/**
 * Параметры запросы блоков схематики из одного или более последовательных чанков.
 * Многие параметры те же, что в {@link TSchematicJobState}
 */
export type TQueryBlocksArgs = {
    jobId       : int
    aabbInSchem : IAABB     // откуда читать из схематики

    // эти параметры нужны не воркеру чтобы найти блоки, а основному потоку чтобы понять какие чанки пришли
    firstChunkIndex  : int
    chunksCount : int
    blocksCount : int
}

export type TQueryBlocksReply = {
    chunks: TBlocksInChunk[]
    args: TQueryBlocksArgs
}

/**
 * Управляет процессом вставки схематики в мир.
 * Выполняет вращение.
 */
export class SchematicJob {

    private jobId       = SchematicJob.nextJobId++  // чтобы различать к какой работе пришло сообщение из воркера
    private world       : ServerWorld
    private worldEdit   : WorldEdit
    private info        : TSchematicInfo

    // сколько и какие чанки и блоки затрагиваются, преобразования координат
    private addr0           : Vector    // адрес 0-го чанка
    private addressesSize   : Vector    // число затронутых чанков по всем направлениям
    schemAABB               : AABB      // AABB схематики в СК мира
    private schemToWorld    : VectorCardinalTransformer
    private worldToSchem    : VectorCardinalTransformer
    private blocksLineIncrement: Vector    // прирост к X и Y мира, когда мы движемся вдоль X в СК мхематики (как там записаны блоки)

    // прогресс вставки
    paused                  = false
    private nextQueryChunk  : int       // следующий чанк который будет запрошен
    totalInsertedChunks     : int       // общее число вставленных чанков
    /**
     * Текущая рабочая копия {@link TSchematicJobState.chunksInserted}.
     * Копируется в {@link TSchematicJobState} перед каждым сохранением мира в БД.
     */
    private insertedChunks  = new Set<int>()
    private pendingActions  = new Set<WorldAction>()    // созданные, но еще не выполненные действия - чтобы их отменить

    // для периодических сообщений пользователю
    private progressMessagePercent      = 0
    private progressMessageTime         : number | null = null
    private progressMessageTimeStarted  : number | null = null
    
    // используется для оценки текущей загруженности - сколько еще можно запросить 
    private chunksInQueries = 0     // запрошенные, но еще еще не полученные чанки
    private blocksInQueries = 0     // запрошенные, но еще еще не полученные блоки
    private chunksInAction  = 0     // для скольких чанков созданы действия, но они еще не вставлены
    private blocksInAction  = 0     // для скольких блоков в созданы действия, но еще не вставлены
    private throttled       : string | null = null // не null если процесс приостановлен пока освободится больше памяти (оценивается по числу грязных блоков + блоков в обработке)

    private static nextJobId = 0

    constructor(worldEdit: WorldEdit) {
        this.worldEdit = worldEdit
        this.world = worldEdit.world
    }

    get state(): TSchematicJobState { return this.info.job }

    /** Инициализирует новую задачу */
    initNew(info: TSchematicInfo): void {
        this.world.state.schematicJob = this.info = info
        this.initCoords()
        info.job = {
            chunksCount : this.addressesSize.volume(),
            consecutiveChunksInserted: 0,
            chunksInserted: []
        }
        this.nextQueryChunk = 0
        this.totalInsertedChunks = 0
    }

    /** Инициализирует возобновление прерванной задачи */
    initResume(): void {
        this.info = this.world.state.schematicJob
        const {state} = this
        this.initCoords()
        this.totalInsertedChunks = state.consecutiveChunksInserted + state.chunksInserted.length
        this.nextQueryChunk = state.consecutiveChunksInserted
        for(const v of state.chunksInserted) {
            this.insertedChunks.add(v)
        }
    }

    /** Добавляет блоки, полученные из воркера, в очередь действий для вставки в мир */
    onBlocksReceived({chunks, args}: TQueryBlocksReply): void {
        if (this.worldEdit.schematicJob !== this) {
            return  // значит, эту задачу отменили до ее завершения
        }
        if (args.jobId !== this.jobId) {
            console.error('onBlocksReceived: args.jobId !== this.jobId')
            return
        }
        const {info, state} = this
        for(let relativeChunkIndex = 0; relativeChunkIndex < args.chunksCount; relativeChunkIndex++) {
            const chunkIndex = args.firstChunkIndex + relativeChunkIndex
            const blocksInChunk = chunks[relativeChunkIndex]
            /** Создаем WorldAction так же, как в {@link WorldEdit.cmd_paste} */
            const action = new WorldAction(null, null, true, false)
            action.blocks.options.chunk_addr = blocksInChunk.addr
            action.blocks.options.can_ignore_air = true
            action.importBlocks(blocksInChunk.blocks)
            action.importFluids(blocksInChunk.fluids)

            // обратный вызов по окончанию вставки
            action.callback = (action) => {
                // отметить эти чанки как вставленные
                this.chunksInAction--
                this.blocksInAction -= blocksInChunk.blocks.length
                this.totalInsertedChunks++
                this.pendingActions.delete(action)
                if (state.consecutiveChunksInserted === chunkIndex) {
                    // перед вставленными чанками нет дыр в нумерации
                    state.consecutiveChunksInserted++
                    // убрать существовавшие дыры в нумерации, если это стало возможным
                    while (this.insertedChunks.delete(state.consecutiveChunksInserted)) {
                        state.consecutiveChunksInserted++
                    }
                } else {
                    // перед вставленными чанками есть дыры в нумерации, запомнить этот 1 чанк как вставленный
                    this.insertedChunks.add(chunkIndex)
                }

                // проверить окончилась ли работа
                if (this.totalInsertedChunks === state.chunksCount) {
                    this.world.chat.sendSystemChatMessageToSelectedPlayers(`!langSchematic pasting has finished, ${
                        Math.round((performance.now() - this.progressMessageTimeStarted) * 0.001)} sec`, [info.user_id])
                    if (this.info.resume) {
                        this.worldEdit.clearSchematic() // если загрузилось автоматически - автоматически и выгрузим
                    } else {
                        this.worldEdit.clearSchematicJob()
                    }
                }
            }
            this.world.actions_queue.add(null, action)
            this.pendingActions.add(action)
            this.chunksInQueries--
            this.chunksInAction++
            this.blocksInAction += blocksInChunk.blocks.length
        }
        this.blocksInQueries -= args.blocksCount
    }

    /** Отменяет текущие действия, если возможно. Не отменяет уже сделанных изменний! */
    clearActions(): void {
        this.paused = true
        this.world.chunks.fluidWorld.schematicAddressesAABB = null  // чтобы подсистема воды приостановила моделирование в этих чанках
        // если задачу отменили - отменить еще не выполненные действия
        for(const action of this.pendingActions) {
            action.blocks.list = []
            action.fluids = []
        }
    }

    /** Добавить новые чанки в обработку, если лимит позволяет. */
    tick(): void {
        if (this.paused) {
            return
        }

        const {world, insertedChunks, blocksLineIncrement} = this
        const {grid} = this.world
        const {chunkSize} = grid
        const {CHUNK_SIZE} = grid.math
        const {chunksCount} = this.state

        while (this.nextQueryChunk < chunksCount) {
            // сколько дополнительно блоков можно запросить
            const maxQueryBlocks = MAX_DIRTY_BLOCKS - world.dbActor.totalDirtyBlocks - this.blocksInQueries - this.blocksInAction
            let maxQueryChunks = maxQueryBlocks / CHUNK_SIZE | 0
            if (maxQueryChunks === 0) {
                this.throttled = 'by blocks'
                break
            }
            // сколько чанков можно запростить
            maxQueryChunks = Math.min(maxQueryChunks, MAX_CHUNK_ACTORS - this.world.dbActor.chunkActorsCount)
            if (maxQueryChunks === 0) {
                this.throttled = 'by chunks'
                break
            }
            this.throttled = null
            // сколько чанков можно добавить в обработку
            maxQueryChunks = Math.min(maxQueryChunks, MAX_CHUNKS_BEING_PROCESSED -  - this.chunksInAction)
            if (maxQueryChunks <= 0) { // мы не считает это throttled - очень скоро действия выполнятся и лимит увеличится
                break
            }

            // пропускаем уже вставленные чанки, если перед ними есть дыры в нумерации (это возможно после возобновления)
            while(insertedChunks.has(this.nextQueryChunk)) {
                this.nextQueryChunk++
            }
            if (this.nextQueryChunk >= chunksCount) {   // если мы заполнили дыры в нумерации и дошли до конца
                break
            }
            // определяем макс. серию запрашиваемых чанков вдоль X или Z (в зависимости от поворота)
            const relativeAddr = this.chunkIndexToRelativeAddr(this.nextQueryChunk) // относительный адрес 0-го чанка в запросе
            let count = blocksLineIncrement.x
                ? (blocksLineIncrement.x > 0 ? this.addressesSize.x - relativeAddr.x : relativeAddr.x + 1)
                : (blocksLineIncrement.z > 0 ? this.addressesSize.z - relativeAddr.z : relativeAddr.z + 1)
            count = Math.min(count, maxQueryChunks)
            // находим сколько можно запросить в непрерывной серии до ближайшего запроешнного (если есть дыры в нумерации)
            for(let i = 1; i < count; i++) {
                if (insertedChunks.has(this.nextQueryChunk + i)) {
                    count = i
                    break
                }
            }

            // подготовить запрос чанков
            const addr = relativeAddr.addSelf(this.addr0) // адрес 0-го чанка в запросе
            const aabbInWorld = grid.getChunkAABB(addr) // AABB заправшиваемых блоков в СК мира
            if (blocksLineIncrement.x) {
                if (blocksLineIncrement.x > 0) {
                    aabbInWorld.x_max += chunkSize.x * (count - 1)
                } else {
                    aabbInWorld.x_min -= chunkSize.x * (count - 1)
                }
            } else {
                if (blocksLineIncrement.z > 0) {
                    aabbInWorld.z_max += chunkSize.z * (count - 1)
                } else {
                    aabbInWorld.z_min -= chunkSize.z * (count - 1)
                }
            }
            aabbInWorld.setIntersect(this.schemAABB)
            if (aabbInWorld.x_min >= aabbInWorld.x_max || aabbInWorld.y_min >= aabbInWorld.y_max || aabbInWorld.z_min >= aabbInWorld.z_max) {
                throw new Error()
            }
            const aabbInSchem = this.worldToSchem.transformAABB(aabbInWorld, new AABB())
            const args: TQueryBlocksArgs = {
                jobId: this.jobId,
                aabbInSchem,
                firstChunkIndex: this.nextQueryChunk,
                chunksCount: count,
                blocksCount: aabbInSchem.volume
            }
            // выполнить запрос
            this.worldEdit.postWorkerMessage(['schem_query_blocks', args])
            this.chunksInQueries += count
            this.blocksInQueries += args.blocksCount
            this.nextQueryChunk += count
        }

        // Отправлять игроку периодические сообщения о прогрессе
        const now = performance.now()
        const progressPercent = Math.floor(this.totalInsertedChunks / this.info.job.chunksCount * 100)
        this.progressMessageTime ??= now
        this.progressMessageTimeStarted ??= now
        if (progressPercent >= this.progressMessagePercent + MIN_PROGRESS_MESSAGE_PERCENT &&
            now >= this.progressMessageTime + MIN_PROGRESS_MESSAGE_SECONDS * 1000 ||
            now >= this.progressMessageTime + MAX_PROGRESS_MESSAGE_SECONDS * 1000
        ) {
            this.progressMessagePercent = progressPercent
            this.progressMessageTime = now
            this.world.chat.sendSystemChatMessageToSelectedPlayers(`!langSchematic pasting progress: ${this.basicProgressToString()}`)
        }
    }

    /** Обновляет {@link TServerWorldState.schematicJob} перед сохранением в БД. */
    updateWorldState(): void {
        this.state.chunksInserted = new Array(...this.insertedChunks.values())
    }

    private initCoords(): void {
        const pos = new Vector(this.info.pos)
        const {rotate, size} = this.info
        const {grid} = this.world
        const offset = new Vector(this.info.offset).rotateByCardinalDirectionSelf(rotate)
        this.schemToWorld = new VectorCardinalTransformer(pos.add(offset), rotate)
        this.worldToSchem = new VectorCardinalTransformer().initInverse(this.schemToWorld)
        const aabb = new AABB().setCornerSize(Vector.ZERO, size)
        this.schemAABB = this.schemToWorld.transformAABB(aabb, aabb)
        this.addr0 = grid.toChunkAddr(this.schemAABB.getMin())
        const addrEnd = grid.toChunkAddr(this.schemAABB.getMax().addSelf(Vector.MINUS_ONE)).addSelf(Vector.ONE) // макс. адрес чанка (не включительно)
        const addressesAABB = new AABB().setCorners(this.addr0, addrEnd) // адреса (не координаты!) затронутых чанков
        this.world.chunks.fluidWorld.schematicAddressesAABB = addressesAABB
        this.addressesSize = addressesAABB.size
        this.blocksLineIncrement = new Vector(1, 0, 0).rotateByCardinalDirectionSelf(rotate)
    }

    private chunkIndexToRelativeAddr(index: int): Vector {
        const {addressesSize} = this
        return new Vector(  // порядок координат тот же что в схематиках - Y, Z, X
            index % addressesSize.x,
            (index / (addressesSize.x * addressesSize.z)) | 0,
            (index / addressesSize.x | 0) % addressesSize.z
        )
    }

    progressToString(): string {
        const {state} = this
        const statusStr = this.paused
            ? '; PAUSED'
            : (this.throttled ? `; THROTTLED ${this.throttled}` : '')
        return `${this.basicProgressToString()}; CHUNKS inserted=${this.totalInsertedChunks}, queried=${this.chunksInQueries}, actions=${this.chunksInAction}, total=${state.chunksCount};` +
            ` BLOCKS queried=${this.blocksInQueries}, in actions=${this.blocksInAction}, dirty=${this.world.dbActor.totalDirtyBlocks}${statusStr}`
    }

    private basicProgressToString(): string {
        return `${Math.floor(this.totalInsertedChunks / this.info.job.chunksCount * 100)}%, ${
            Math.round((performance.now() - this.progressMessageTimeStarted) * 0.001)} sec`
    }
}