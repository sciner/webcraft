import {Vector} from "@client/helpers/vector.js";
import type {ServerWorld} from "../../server_world.js";
import type {TSchematicInfo} from "../chat_worldedit.js";
import {AABB, IAABB} from "@client/core/AABB.js";
import {WorldAction} from "@client/world_action.js";
import type {TBlocksInChunk} from "./schematic_reader.js";
import {VectorCardinalTransformer} from "@client/helpers/vector_cardinal_transformer.js";
import type WorldEdit from "../chat_worldedit.js";
import type {IWorkerChunkCreateArgs} from "@client/worker/chunk.js";
import type {TChunkWorkerMessageBlocksGenerated} from "@client/worker/messages.js";
import {ObjectHelpers} from "@client/helpers/object_helpers.js";
import {CHUNK_STATE} from "@client/chunk_const.js";
import {ArrayHelpers} from "@client/helpers/array_helpers.js";
import type {TBlocksSavedState} from "@client/typed_blocks3.js";
import {ServerClient} from "@client/server_client.js";
import {Mth} from "@client/helpers/mth.js";

/** Опции, вляющие на скорость вставки, и потребление памяти и нагрузку на CPU */
export type TSchematicJobOptions = {

    /**
     * Макс. размер файла, загружаемый в память. Это не имееет отношения к {@link SchematicJob}, а
     * используется ранее, на этапе загрузки схематики. Но размещено тут, т.к. удобно иметь все опции,
     * вляющие на память/производительность, в одном месте.
     */
    max_memory_file_size: int

    /** Сколько чанков могут одновременно находиться в обработке (в воркере или в WorldActions) */
    max_chunks_processed: int

    /**
     * Максимальное число грязных блоков в памяти, при котором возможен запрос новых чанков.
     * Больше значение => больше размер JSON в одной транзакции => больше тормозов.
     */
    max_dirty_blocks: int

    /**
     * Максимальное число {@link ChunkDBActor} (т.е. чанков или данных чанков без самих чанков), при котором
     * возможен запрос новых чанков. Это в основном лимитирует потребление памяти.
     */
    max_chunk_actors: int

    max_chunks_per_read: int // макс. чанков в одном запросе на чтение

    /**
     * Если true, и вставляется с воздухом, и в мире нет такого чанка, то чанк запрашивается у генератора
     * и в мир вставляются только блоки отличные от генератора.
     */
    use_generator: boolean
}

export const SCHEMATIC_JOB_OPTIONS: Dict<TSchematicJobOptions> = {
    /** Опции, почти наверняка не исчерпывающие память, но несколько тормозящие игру. */
    safe: {
        max_memory_file_size: 100 * 1000000,
        max_chunks_processed: 256,
        max_dirty_blocks    : 200 * 1000,
        max_chunk_actors    : 20 * 1000,
        max_chunks_per_read : 32,
        use_generator       : true
    },
    /** Опции для медленной вставки, не нарушающей процесс игры. */
    slow: {
        max_memory_file_size: 50 * 1000000,
        max_chunks_processed: 32,
        max_dirty_blocks    : 100 * 1000,
        max_chunk_actors    : 20 * 1000,
        max_chunks_per_read : 16,
        use_generator       : true
    },
    /**
     * Опции "прочитать как можно быстрее, закинуть много в мир и пусть игра хоть падает".
     * Приближены к старому режиму. Есть шанс что память на закончится во время вставки.
     */
    unsafe: {
        max_memory_file_size: 500 * 1000000,
        max_chunks_processed: Infinity,
        max_dirty_blocks    : 2 * 1000000,
        max_chunk_actors    : 40 * 1000,
        max_chunks_per_read : 32,
        use_generator       : true
    }
}

const PROGRESS_MESSAGE_MILLISECONDS = 1000  // насколько часто слать сообщения о прогрессе

/** Состояние процесса вставки схематики в мир, хранящееся в БД */
export type TSchematicJobState = {
    chunks_count: int               // общее число затронутых чанков. Может быть вычислено по pos и size, но хранится отдельным полем для простоты
    consecutive_chunks_inserted: int // все чанки до этого номера включительно вставлены
    /**
     * Некоторые вставленные чанки после {@link consecutive_chunks_inserted} с дырами в нумерации.
     * Дыры в нумераии (нарушение порядка вставки) можут быть, например, из-за {@link ServerChunk.pendingWorldActions}.
     * Когда дыры заполнятся, чанки будут удалены из этого списка и увеличится {@link consecutive_chunks_inserted}.
     */
    chunks_inserted: int[]
}

/**
 * Параметры запросы блоков схематики из одного или более последовательных чанков.
 * Многие параметры те же, что в {@link TSchematicJobState}
 */
export type TQueryBlocksArgs = {
    job_id       : int
    aabb_in_schem : IAABB     // откуда читать из схематики
    blocks_line_increment : IVector // в какую сторону увеличиваются индексы боков - для сортировка чанков

    // эти параметры нужны не воркеру чтобы найти блоки, а основному потоку чтобы понять какие чанки пришли
    first_chunk_index  : int
    chunks_count : int
    blocks_count : int
}

export type TQueryBlocksReply = {
    chunks: TBlocksInChunk[]
    args: TQueryBlocksArgs
}

/**
 * Управляет процессом вставки схематики в мир в каждом тике мира - см. {@link tick}.
 * Выполняет вращение.
 */
export class SchematicJob {

    private job_id      = SchematicJob.next_job_id++  // чтобы различать к какой работе пришло сообщение из воркера
    private world       : ServerWorld
    private world_edit   : WorldEdit
    private options     : TSchematicJobOptions
    private info        : TSchematicInfo

    // сколько и какие чанки и блоки затрагиваются, преобразования координат
    private addr0           : Vector    // адрес 0-го чанка
    private addresses_size  : Vector    // число затронутых чанков по всем направлениям
    schemAABB               : AABB      // AABB схематики в СК мира
    private schem_to_world  : VectorCardinalTransformer
    private world_to_schem  : VectorCardinalTransformer
    private blocks_line_increment: Vector    // прирост к X и Y мира, когда мы движемся вдоль X в СК мхематики (как там записаны блоки)

    // прогресс вставки
    paused                      = false
    private next_query_chunk    : int   // следующий чанк который будет запрошен
    total_inserted_chunks       : int   // общее число вставленных чанков
    /**
     * Текущая рабочая копия {@link TSchematicJobState.chunks_inserted}.
     * Копируется в {@link TSchematicJobState} перед каждым сохранением мира в БД.
     */
    private inserted_chunks  = new Set<int>()
    private pending_actions  = new Set<WorldAction>()    // созданные, но еще не выполненные действия - чтобы их отменить

    // для периодических сообщений пользователю
    private progress_message_time         = -Infinity         // время последнего сообщения пользователю
    private progress_message_time_started = performance.now()
    
    // используется для оценки текущей загруженности - сколько еще можно запросить 
    private chunks_in_queries   = 0     // запрошенные, но еще еще не полученные чанки
    private blocks_in_queries   = 0     // запрошенные, но еще еще не полученные блоки
    private chunks_in_generator = new Map<int, WorldAction>()
    private blocks_in_generator = 0
    private chunks_in_action    = 0     // для скольких чанков созданы действия, но они еще не вставлены
    private blocks_in_action    = 0     // для скольких блоков в созданы действия, но еще не вставлены
    private throttled           : string | null = null // не null если процесс приостановлен пока освободится больше памяти (оценивается по числу грязных блоков + блоков в обработке)

    private static next_job_id = 0

    constructor(world_edit: WorldEdit, options: TSchematicJobOptions) {
        this.world_edit = world_edit
        this.world = world_edit.world
        this.options = options
    }

    get state(): TSchematicJobState { return this.info.job }

    /** Инициализирует новую задачу */
    initNew(info: TSchematicInfo): void {
        this.world.state.schematic_job = this.info = info
        this.initCoords()
        info.job = {
            chunks_count : this.addresses_size.volume(),
            consecutive_chunks_inserted: 0,
            chunks_inserted: []
        }
        this.next_query_chunk = 0
        this.total_inserted_chunks = 0
    }

    /** Инициализирует возобновление прерванной задачи */
    initResume(): void {
        this.info = this.world.state.schematic_job
        const {state} = this
        this.initCoords()
        this.total_inserted_chunks = state.consecutive_chunks_inserted + state.chunks_inserted.length
        this.next_query_chunk = state.consecutive_chunks_inserted
        for(const v of state.chunks_inserted) {
            this.inserted_chunks.add(v)
        }
    }

    /**
     * Добавляет блоки, полученные из воркера схематик, в очередь действий для вставки в мир.
     * Если нужно, сравнивает их с чанком или запрашивает результат генератора, чтобы не вставлять совпадающие блоки.
     */
    onBlocksReceived({chunks, args}: TQueryBlocksReply): void {
        if (this.world_edit.schematic_job !== this || this.world.shutting_down) {
            return  // значит, эту задачу отменили до ее завершения
        }
        if (args.job_id !== this.job_id) {
            console.error('onBlocksReceived: args.job_id !== this.job_id')
            return
        }
        const {info, state} = this
        for(let relative_chunk_index = 0; relative_chunk_index < args.chunks_count; relative_chunk_index++) {
            const chunk_index = args.first_chunk_index + relative_chunk_index
            const blocks_in_chunk = chunks[relative_chunk_index]
            /** Создаем WorldAction так же, как в {@link WorldEdit.cmd_paste} */
            const action = new WorldAction(null, null, true, false)
            action.blocks.options.chunk_addr = blocks_in_chunk.addr
            action.blocks.options.ignore_equal = true
            action.importBlocks(blocks_in_chunk.blocks)
            if (blocks_in_chunk.fluids.length) {
                action.importFluids(blocks_in_chunk.fluids)
                action.fluidFlush = true
            }

            // обратный вызов по окончанию вставки
            action.callback = (action: WorldAction) => {
                if (chunk) {
                    ArrayHelpers.fastDeleteValue(chunk.neededBy, this) // если раньше мы не разрешали ему выгрузится - уже можно
                }

                if (this.world_edit.schematic_job !== this) {
                    return  // значит, эту задачу отменили до ее завершения
                }
                // отметить эти чанки как вставленные
                this.chunks_in_action--
                this.blocks_in_action -= action.blocks.list.length
                this.total_inserted_chunks++
                this.pending_actions.delete(action)
                if (state.consecutive_chunks_inserted === chunk_index) {
                    // перед вставленными чанками нет дыр в нумерации
                    state.consecutive_chunks_inserted++
                    // убрать существовавшие дыры в нумерации, если это стало возможным
                    while (this.inserted_chunks.delete(state.consecutive_chunks_inserted)) {
                        state.consecutive_chunks_inserted++
                    }
                } else {
                    // перед вставленными чанками есть дыры в нумерации, запомнить этот 1 чанк как вставленный
                    this.inserted_chunks.add(chunk_index)
                }

                // проверить окончилась ли работа
                if (this.total_inserted_chunks === state.chunks_count) {
                    this.world.chat.sendSystemChatMessageToSelectedPlayers(`!langSchematic pasting has finished, ${
                        Mth.round((performance.now() - this.progress_message_time_started) * 0.001, 3)} sec`, [info.user_id])
                    // все действия выполнились, но последние блоки еще наверное не записались
                    this.world.dbActor.worldSavingPromise.then(() => {
                        this.world.chat.sendSystemChatMessageToSelectedPlayers(`!langSchematic saving has finished, ${
                            Mth.round((performance.now() - this.progress_message_time_started) * 0.001, 3)} sec`, [info.user_id])
                    })
                    if (this.info.resume) {
                        this.world_edit.clearSchematic() // если загрузилось автоматически - автоматически и выгрузим
                    } else {
                        this.world_edit.clearSchematicJob()
                    }
                }
            }

            this.chunks_in_queries--

            // Если есть такой чанк, то можно сразу добавить действия в мир
            const chunk = this.world.chunks.getInAnyState(blocks_in_chunk.addr)
            if (this.options.use_generator && !chunk && this.info.read_air) {
                // нужно сгенерировать чанк и сравнить с результатом генератора, чтобы не вставялть совпадающие блоки
                const args: IWorkerChunkCreateArgs = {
                    addr:           blocks_in_chunk.addr,
                    uniqId:         null,
                    modify_list:    null,
                    for_schematic:   { job_id: this.job_id, index: chunk_index }
                }
                this.world.chunks.postWorkerMessage(['createChunk', [args]])
                this.chunks_in_generator.set(chunk_index, action)
                this.blocks_in_generator += blocks_in_chunk.blocks.length
            } else {
                if (chunk) {
                    if (chunk.load_state <= CHUNK_STATE.READY) {
                        // Чанк загружен или скоро загрузится
                        // Блоки должны сравниться при вставке чанк. Пометим чанк чтобы он не выгрузился пока эти действия в нем не выполнятся.
                        chunk.neededBy.push(action)
                    } else if (chunk.tblocks) {
                        // Чанк есть, но выгружен. Возможно, действия будут обработаны без него. Но сейчас у нас есть данные
                        // этого чанка. Сравним их с блоками схематики. Тогда не важно, будут ли они потом еще раз сравнены с чанком или нет.
                        this.removeEqualBlocks(action, chunk.tblocks.saveState())
                    }
                }
                this.world.actions_queue.add(null, action)
                this.pending_actions.add(action)
                this.chunks_in_action++
                this.blocks_in_action += action.blocks.list.length
            }
        }
        this.blocks_in_queries -= args.blocks_count
    }

    /** Если пришли блоки из генератора - сравнить с ними вставляемые блоки. */
    onBlocksGenerated({for_schematic, tblocks}: TChunkWorkerMessageBlocksGenerated): void {
        if (this.world_edit.schematic_job !== this || for_schematic.job_id !== this.job_id || this.world.shutting_down) {
            return  // значит, эту задачу отменили до ее завершения
        }
        const action = this.chunks_in_generator.get(for_schematic.index)
        this.chunks_in_generator.delete(for_schematic.index)
        this.blocks_in_generator -= action.blocks.list.length
        // удалить блоки, совпадающие с генератором
        this.removeEqualBlocks(action, tblocks)
        // добавить действие в мир
        this.world.actions_queue.add(null, action)
        this.pending_actions.add(action)
        this.chunks_in_action++
        this.blocks_in_action += action.blocks.list.length
    }

    /** Отменяет текущие действия, если возможно. Не отменяет уже сделанных изменений! */
    clearActions(): void {
        this.paused = true
        this.world.chunks.fluidWorld.schematicAddressesAABB = null  // чтобы подсистема воды приостановила моделирование в этих чанках
        // если задачу отменили - отменить еще не выполненные действия
        for(const action of this.pending_actions) {
            action.blocks.list = []
            action.fluids = []
        }
    }

    /** Добавить новые чанки в обработку, если лимит позволяет. */
    tick(): void {
        if (this.paused || this.world.shutting_down) {
            return
        }

        const {world, inserted_chunks, blocks_line_increment, options, addresses_size} = this
        const {grid} = this.world
        const {chunkSize} = grid
        const {CHUNK_SIZE} = grid.math
        const {chunks_count} = this.state

        while (this.next_query_chunk < chunks_count) {
            // сколько дополнительно блоков можно запросить
            const max_query_blocks = options.max_dirty_blocks - world.dbActor.totalDirtyBlocks - this.blocks_in_queries - this.blocks_in_generator - this.blocks_in_action
            let max_query_chunks = max_query_blocks / CHUNK_SIZE | 0
            if (max_query_chunks <= 0) {
                const max = Math.max(world.dbActor.totalDirtyBlocks, this.blocks_in_queries, this.blocks_in_generator, this.blocks_in_action)
                this.throttled = (max === world.dbActor.totalDirtyBlocks) ? 'by DB'
                    : (max === this.blocks_in_queries) ? 'by reading'
                    : (max === this.blocks_in_generator) ? 'by generating'
                    : 'by actions'
                break
            }
            // сколько чанков можно добавить в мир
            const chunks_being_processed = this.chunks_in_queries - this.chunks_in_generator.size - this.chunks_in_action 
            max_query_chunks = Math.min(max_query_chunks, options.max_chunk_actors - this.world.dbActor.chunkActorsCount - chunks_being_processed)
            if (max_query_chunks <= 0) {
                this.throttled = 'by total chunks number'
                break
            }
            max_query_chunks = Math.min(max_query_chunks, options.max_chunk_actors - this.world.dbActor.chunkActorsCount - chunks_being_processed)
            // сколько чанков можно добавить в обработку
            max_query_chunks = Math.min(max_query_chunks, options.max_chunks_per_read, options.max_chunks_processed - chunks_being_processed)
            if (max_query_chunks <= 0) { // мы не считает это throttled - очень скоро действия выполнятся и лимит увеличится
                this.throttled = 'by chunks being processed'
                break
            }
            this.throttled = null

            // пропускаем уже вставленные чанки, если перед ними есть дыры в нумерации (это возможно после возобновления)
            while(inserted_chunks.has(this.next_query_chunk)) {
                this.next_query_chunk++
            }
            const {next_query_chunk} = this
            if (next_query_chunk >= chunks_count) {   // если мы заполнили дыры в нумерации и дошли до конца
                break
            }

            // относительный адрес 0-го чанка в запросе
            let relative_addr: Vector
            if (blocks_line_increment.x) { // запрашиваем вдоль X мира
                relative_addr = new Vector(  // порядок координат тот же что в схематиках - Y, Z, X
                    next_query_chunk % addresses_size.x,
                    (next_query_chunk / (addresses_size.x * addresses_size.z)) | 0,
                    (next_query_chunk / addresses_size.x | 0) % addresses_size.z
                )
                if (blocks_line_increment.x < 0) {
                    relative_addr.x = addresses_size.x - 1 - relative_addr.x
                }
            } else { // запрашиваем вдоль Z мира
                relative_addr = new Vector(
                    (next_query_chunk / addresses_size.z | 0) % addresses_size.x,
                    (next_query_chunk / (addresses_size.z * addresses_size.x)) | 0,
                    next_query_chunk % addresses_size.z,
                )
                if (blocks_line_increment.z < 0) {
                    relative_addr.z = addresses_size.z - 1 - relative_addr.z
                }
            }
            // определяем макс. серию запрашиваемых чанков вдоль X или Z (в зависимости от поворота)
            let count = blocks_line_increment.x
                ? (blocks_line_increment.x > 0 ? addresses_size.x - relative_addr.x : relative_addr.x + 1)
                : (blocks_line_increment.z > 0 ? addresses_size.z - relative_addr.z : relative_addr.z + 1)
            count = Math.min(count, max_query_chunks)
            // находим сколько можно запросить в непрерывной серии до ближайшего запрошенного (если есть дыры в нумерации)
            for(let i = 1; i < count; i++) {
                if (inserted_chunks.has(next_query_chunk + i)) {
                    count = i
                    break
                }
            }

            // подготовить запрос чанков
            const addr = relative_addr.addSelf(this.addr0) // адрес 0-го чанка в запросе
            const aabb_in_world = grid.getChunkAABB(addr) // AABB запрашиваемых блоков в СК мира
            if (blocks_line_increment.x) {
                if (blocks_line_increment.x > 0) {
                    aabb_in_world.x_max += chunkSize.x * (count - 1)
                } else {
                    aabb_in_world.x_min -= chunkSize.x * (count - 1)
                }
            } else {
                if (blocks_line_increment.z > 0) {
                    aabb_in_world.z_max += chunkSize.z * (count - 1)
                } else {
                    aabb_in_world.z_min -= chunkSize.z * (count - 1)
                }
            }
            aabb_in_world.setIntersect(this.schemAABB)
            if (aabb_in_world.x_min >= aabb_in_world.x_max || aabb_in_world.y_min >= aabb_in_world.y_max || aabb_in_world.z_min >= aabb_in_world.z_max) {
                throw new Error()
            }
            const aabb_in_schem = this.world_to_schem.transformAABB(aabb_in_world, new AABB())
            const args: TQueryBlocksArgs = {
                job_id: this.job_id,
                aabb_in_schem,
                blocks_line_increment,
                first_chunk_index: this.next_query_chunk,
                chunks_count: count,
                blocks_count: aabb_in_schem.volume
            }
            // выполнить запрос
            this.world_edit.postWorkerMessage(['schem_query_blocks', args])
            this.chunks_in_queries += count
            this.blocks_in_queries += args.blocks_count
            this.next_query_chunk += count
        }

        // Отправлять игроку периодические сообщения о прогрессе
        const now = performance.now()
        if (now >= this.progress_message_time + PROGRESS_MESSAGE_MILLISECONDS) {
            this.progress_message_time = now
            const percent = this.total_inserted_chunks / this.info.job.chunks_count
            this.world.sendSelected([{
                name: ServerClient.CMD_PROGRESSBAR,
                data: {
                    text: `Lang.pasting_schematic|${Mth.round(percent * 100, 1)}`,
                    percent
                }
            }], [this.info.user_id])
        }
    }

    /** Обновляет {@link TServerWorldState.schematic_job} перед сохранением в БД. */
    updateWorldState(): void {
        this.state.chunks_inserted = new Array(...this.inserted_chunks.values())
    }

    private initCoords(): void {
        const pos = new Vector(this.info.pos)
        const {rotate, size} = this.info
        const {grid} = this.world
        const offset = new Vector(this.info.offset).rotateByCardinalDirectionSelf(rotate)
        this.schem_to_world = new VectorCardinalTransformer(pos.add(offset), rotate)
        this.world_to_schem = new VectorCardinalTransformer().initInverse(this.schem_to_world)
        const aabb = new AABB().setCornerSize(Vector.ZERO, size)
        this.schemAABB = this.schem_to_world.transformAABB(aabb, aabb)
        this.addr0 = grid.toChunkAddr(this.schemAABB.getMin())
        const addrEnd = grid.toChunkAddr(this.schemAABB.getMax().addSelf(Vector.MINUS_ONE)).addSelf(Vector.ONE) // макс. адрес чанка (не включительно)
        const addressesAABB = new AABB().setCorners(this.addr0, addrEnd) // адреса (не координаты!) затронутых чанков
        this.world.chunks.fluidWorld.schematicAddressesAABB = addressesAABB
        this.addresses_size = addressesAABB.size
        this.blocks_line_increment = new Vector(1, 0, 0).rotateByCardinalDirectionSelf(rotate)
    }

    /**
     * Сравнивает блоки из схематики, приготовленые для вставки в мир, с блоками чанка или генератора.
     * Удаляет совпадающие. Чтобы в БД меньше записывалось.
     */
    private removeEqualBlocks(action: WorldAction, tblocks: TBlocksSavedState): void {
        const generated_ids = tblocks.id
        const action_blocks_list = action.blocks.list
        let src_list_index = 0
        let dst_list_index = 0
        while (src_list_index < action_blocks_list.length) {
            const block = action_blocks_list[src_list_index++]
            const {posi, item} = block
            // см. похожую проверку в TBlock.equal
            if (item.id === generated_ids[posi] && (item.id === 0 ||
                    item.entity_id == tblocks.entity_id.get(posi) &&
                    ObjectHelpers.deepEqual(item.rotate, tblocks.rotate.get(posi)) &&
                    ObjectHelpers.deepEqual(item.extra_data, tblocks.extra_data.get(posi))
                )
            ) {
                continue // блоки совпадают, не нужно включать этот блок в действие
            }
            action_blocks_list[dst_list_index++] = block
        }
        action_blocks_list.length = dst_list_index
        action.blocks.options.ignore_equal = false // уже выполнили эту проверку - не надо проверять второй раз
    }

    progressToString(): string {

        const add = (str: string, v: int) => {
            if (v) {
                result += add_comma ? ', ' : ' '
                add_comma = true
                result += `${str}=${v}`
            }
        }

        const {state} = this
        let result = `${Mth.round(this.total_inserted_chunks / this.info.job.chunks_count * 100, 2)}%, ${
            Math.round((performance.now() - this.progress_message_time_started) * 0.001)} sec; CHUNKS`
        let add_comma = false
        add('inserted',     this.total_inserted_chunks)
        add('queried',      this.chunks_in_queries)
        add('generating',   this.chunks_in_generator.size)
        add('actions',      this.chunks_in_action)
        add('total',        state.chunks_count)
        add_comma = false
        result += '; BLOCKS'
        add('queried',      this.blocks_in_queries)
        add('in actions',   this.blocks_in_action)
        add('generating',   this.blocks_in_generator)
        add('dirty',        this.world.dbActor.totalDirtyBlocks)
        result += this.paused
            ? '; PAUSED'
            : (this.throttled ? `; THROTTLED ${this.throttled}` : '')
        return result
    }

}