import { ObjectHelpers, Vector, VectorCollector } from "@client/helpers.js";
import {WorldAction} from "@client/world_action.js";
import { BLOCK_ACTION, ServerClient } from "@client/server_client.js";
import {FLUID_LAVA_ID, FLUID_TYPE_MASK, FLUID_WATER_ID, isFluidId} from "@client/fluid/FluidConst.js";
import { WorldEditBuilding } from "./worldedit/building.js";
import { BuildingTemplate } from "@client/terrain_generator/cluster/building_template.js";
import { BLOCK_SAME_PROPERTY, DBItemBlock } from "@client/blocks.js";
import type { ServerWorld } from "server_world";
import type { ChunkGrid } from "@client/core/ChunkGrid";
import type { ServerChat } from "server_chat";
import type { ServerChunk } from "server_chunk";
import type {ServerPlayer} from "../server_player.js";
import {SCHEMATIC_JOB_OPTIONS, SchematicJob, TSchematicJobState} from "./worldedit/schematic_job.js";
import path from 'path';
import type {TBinarySchematicCookie} from "./worldedit/binary_schematic.js";

const MAX_SET_BLOCK         = 250000 * 4
const MAX_BLOCKS_PER_PASTE  = 10000
const QUBOID_SET_COMMANDS = ['/set', '/walls', '/faces'];

/** Задержка до начала автоматической загрузки схематики после старта мира */
const SCHEMATIC_RESUME_DELAY_SECONDS    = 20

/** Опции, вляющие на скорость вставки схематики, и потребление памяти и нагрузку на CPU */
const DEFAULT_SCHEMATIC_JOB_OPTIONS = SCHEMATIC_JOB_OPTIONS['safe']

enum QUBOID_SET_TYPE {
    FILL = 1,
    WALLS = 2,
    FACES = 3,
}

export type TWorldEditCopy = {
    quboid: IQuboidInfo,
    blocks: VectorCollector,
    fluids: int[],
    player_pos: IVector | null
}

enum SchematicState {
    INITIAL_TIMEOUT = 0, // сразу после загрузки мира
    LOADING,    // послали сообщение о загрузке в воркер, но ответ еще не пришел
    LOADED,     // чтобы узнать встявляется ли в это время - см. наличие WorldEdit.schematic_job
    UNLOADING   // послали сообщение об очистке в воркер, но ответ еще не пришел
}

declare type ICheckSchematicOptions = {
    anyPlayer?: boolean // если true, то проверяет схематику, загруженну любым игроком. Иначе - только этим
    pasting?: boolean // проверяет если схематика сейчас вставляется
    loading?: boolean // проверяет если не загружена
}

/**
 * Описывает cхематику, загруженную в настоящее время в вебворкер, а также примененные к ней преобразования.
 *
 * Этот объект может независимо присутствовать или отсутствовать в дву местах:
 * - {@link WorldEdit.schematic_info} - если сейчас схематика загружена
 * - {@link TServerWorldState.schematic_job} и соответвтсвующее поле в БД - если был или есть процесс вставки
 *   Возможно что сразу после загрузки мира {@link TServerWorldState.schematic_job} не null, но
 *   {@link WorldEdit.schematic_info} == null - значит еще не загрузилась, но скоро загрузится.
 */
export type TSchematicInfo = {
    user_id         : int       // кто ее загрузил
    username        : string

    resume?         : boolean   // true если это повторная загрузка
    state           : SchematicState

    // что и как загружали
    file_cookie      : TBinarySchematicCookie
    orig_file_name? : string
    file_name?      : string
    size?           : IVector
    offset?         : IVector   // если в самой схематике прописано смещение - Metadata.WEOffsetX ...
    /**
     * Этот параметр не влияет на загрузку. Мы могли бы указывать его перед вставкой. Но чтобы команды
     * выглядели как раньше, он указывается при загрузке, запоминается, и потом его нельзя поменять.
     */
    read_air        : boolean

    // преобразования, примененные командами и параметры вставки
    rotate  : int
    pos?    : IVector   // Позиция блока схамтики, на который указывает ее offset с учетом поворта, в мире

    job?    : TSchematicJobState    // если не null - текущее состояние процесса вставки
}

/** Описание чего основной поток ждет от воркера */
type TWorldEditWaiting = { text: string, requestId: int }

export default class WorldEdit {
    id: number;
    worker: Worker;
    world: ServerWorld;
    chat: ServerChat;
    building: WorldEditBuilding;
    commands: Map<string, Function>;

    /**
     * Описание загруженной сейчас в вебворкере схематики. Одновременно может быть загружена только одна - для
     * простоты, и для экономии ресурсов.
     *
     * Важно также учитывать поле {@link TServerWorldState.schematic_job} - см. {@link TSchematicInfo}
     */
    schematic_info: TSchematicInfo | null = null
    /**
     * Если в настоящий момент схематика вставляется - это прогресс текущей вставки.
     *
     * Может быть что это поле null, но {@link TServerWorldState.schematic_job} не null. Это значит, что
     * есть неоконченная вставка, но в настоящий момент схематика не загружена и вставка не продолжается.
     * Ее можно возобновить через /schem resume
     */
    schematic_job: SchematicJob | null

    private schematic_job_options = DEFAULT_SCHEMATIC_JOB_OPTIONS

    /** Если не null, то ожидаем ответа по указанной команде от воркера и пока не принимаем других команд по схематикам */
    private waiting: TWorldEditWaiting | null = null
    private next_waiting_request_id: int = 0

    static targets = ['chat'];

    constructor() {
        this.id = performance.now()
    }

    initWorker() {
        const fileName = path.join(globalThis.__dirname, 'plugins/worldedit/worker.js')
        this.worker = new Worker(fileName);

        const onmessage = (data) => {
            if(data instanceof MessageEvent) {
                data = data.data
            }
            // console.log('worker -> chat_worldedit', data)
            const [cmd, args] = data
            const user_id = args.args?.user_id ?? args.args.info?.user_id
            if (args?.args?.waitingRequestId === this.waiting?.requestId) {
                this.waiting = null  // если ждали этго ответа ответа - больше не ждем
            }
            switch(cmd) {
                case 'schem_loaded': {
                    this.schematic_info = args.info
                    this.schematic_info.state = SchematicState.LOADED
                    if (args.msg) {
                        this.chat.sendSystemChatMessageToSelectedPlayers(args.msg, [user_id])
                    }
                    if (args.info.resume) {
                        // если авто-возобновляем, то всегда медленно и безопасно
                        this.schematic_job = new SchematicJob(this, SCHEMATIC_JOB_OPTIONS['safe'])
                        this.schematic_job.initResume()
                        this.chat.sendSystemChatMessageToSelectedPlayers(`!langPasting of schematic ${this.schematic_info.orig_file_name} has resumed automatically.`, [user_id])
                    }
                    break;
                }
                case 'schem_blocks': { // пришли запрошенные блоки для процесса вставки
                    this.schematic_job?.onBlocksReceived(args)
                    break
                }
                case 'schem_cleared': {
                    if (this.schematic_info?.state === SchematicState.UNLOADING) { // если ответ пришел к текущей схематике
                        this.schematic_info = null
                        if (args.args.notify) {
                            this.chat.sendSystemChatMessageToSelectedPlayers('clipboard_cleared', [user_id])
                        }
                    }
                    break;
                }
                case 'schem_error': {
                    const msg = args.e.length < 200 ? args.e : '!langError while processing the schematic.'
                    this.chat.sendSystemChatMessageToSelectedPlayers(msg, [user_id])
                    this.clearSchematicJob()
                    this.schematic_info = null
                    break
                }
            }
        }
        const onerror = (e) => {
            console.error(e)
            debugger
        };
        if('onmessage' in this.worker) {
            this.worker.onmessage = onmessage;
            this.worker.onerror = onerror;
        } else {
            (this.worker as any).on('message', onmessage);
            (this.worker as any).on('error', onerror);
        }
        this.postWorkerMessage(['init', {
            worldGUID: this.world.info.guid,
            chunkGridOptions: this.world.grid.options
        }])
    }

    /**
     * @param waitingText - если задано, то большинство команд не будут выполняться пока не придет ответ
     *  от воркера на эту команду. А это значение будет выводиться пользователю при попытке выполнить другие
     *  команды.
     */
    postWorkerMessage(cmd: [string, Dict], waitingText?: string): void {
        if(!this.worker) {
            this.initWorker()
        }
        if (waitingText) {  // если нужно, начать ожидание ответа на это сообщение
            this.waiting = {
                text: waitingText,
                requestId: ++this.next_waiting_request_id
            }
            cmd[1].waitingRequestId = this.waiting.requestId
        }
        this.worker.postMessage(cmd)
    }

    onGame(game) {}

    onWorld(world) {}

    onChat(chat: ServerChat) {
        
        if(!this.world) {
            this.chat = chat
            this.world = chat.world
            this.chat.world_edit = this
            // авто-возобновление вставки схематики
            const info = this.world.state.schematic_job
            if (info) {
                info.resume = true
                info.state = SchematicState.INITIAL_TIMEOUT
                setTimeout(() => {
                    // если за это время не загрузили другую схематику и не очистили
                    if (this.world.state.schematic_job === info) {
                        info.state = SchematicState.LOADING
                        this.postWorkerMessage(['schem_load', {
                            info,
                            max_memory_file_size: SCHEMATIC_JOB_OPTIONS['safe'].max_memory_file_size
                        }], 'schematic pasting resume')
                    }
                }, SCHEMATIC_RESUME_DELAY_SECONDS * 1000)
            }
        }

        this.building = new WorldEditBuilding(this);

        //
        this.commands = new Map();
        this.commands.set('/desel', this.cmd_desel);
        this.commands.set('/pos1', this.cmd_pos1);
        this.commands.set('/pos2', this.cmd_pos2);
        this.commands.set('/xyz1', this.cmd_xyz1);
        this.commands.set('/xyz2', this.cmd_xyz2);
        this.commands.set('/copy', this.cmd_copy);
        this.commands.set('/paste', this.cmd_paste);
        this.commands.set('/set', this.cmd_set);
        this.commands.set('/walls', this.cmd_set);
        this.commands.set('/faces', this.cmd_set);
        this.commands.set('/replace', this.cmd_replace);
        this.commands.set('/drain', this.cmd_drain);
        this.commands.set('/drown', this.cmd_drown);
        this.commands.set('/schem', this.cmd_schematic);
        this.commands.set('/schematic', this.cmd_schematic);
        this.commands.set('/clearclipboard', this.cmd_clearclipboard);
        this.commands.set('/building', this.cmd_building);
        this.commands.set('/rotate', this.cmd_rotate)
        this.commands.set('/shearleaves', this.cmd_shearleaves);
        // this.commands.set('//line', this.);
        // this.commands.set('//flora', this.);
        // this.commands.set('//undo', this.);

        // On chat command
        chat.onCmd(async (player, cmd, args) => {
            while(cmd.indexOf('//') === 0) {
                cmd = cmd.substring(1)
            }
            const f = this.commands.get(cmd);
            if(f) {
                if(!chat.world.admins.checkIsAdmin(player)) {
                    throw 'error_not_permitted';
                }
                try {
                    await f.call(this, chat, player, cmd, args);
                } catch(e) {
                    console.log(e);
                    throw e;
                }
                return true;
            }
        });

    }

    // Clear clipboard
    async cmd_clearclipboard(chat, player: ServerPlayer, cmd, args) {
        delete player._world_edit_copy
        // если есть схематика загруженная или загружаемая этим игроком, то команда относится к ней
        if (this.clearSchematic(player, true)) {
            return
        }
        chat.sendSystemChatMessageToSelectedPlayers('clipboard_cleared', player);
    }

    /**
     * Reset selected region
     */
    async cmd_desel(chat, player, cmd, args) {
        player.pos1 = null;
        player.pos2 = null;
        this.updatePos1Pos2(chat, player)
    }

    /**
     * Set first point of selecting region
     */
    async cmd_pos1(chat, player, cmd, args) {
        player.pos1 = player.state.pos.floored();
        let msg = `!langpos1 = ${player.pos1.x}, ${player.pos1.y}, ${player.pos1.z}`;
        if(player.pos2) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id])
        this.updatePos1Pos2(chat, player)
    }

    /**
     * Set second point of selecting region
     */
    async cmd_pos2(chat, player, cmd, args) {
        player.pos2 = player.state.pos.floored();
        let msg = `!langpos2 = ${player.pos2.x}, ${player.pos2.y}, ${player.pos2.z}`;
        if(player.pos1) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        this.updatePos1Pos2(chat, player)
    }

    updatePos1Pos2(chat, player) {
        let {pos1, pos2} = player
        if(pos1 && !pos2) {
            player.pos2 = pos2 = pos1.clone()
        }
        if(pos2 && !pos1) {
            player.pos1 = pos1 = pos2.clone()
        }
        const packets = [{
            name: ServerClient.CMD_POS1POS2,
            data: {pos1, pos2}
        }]
        player.sendPackets(packets)
        // const actions = new WorldAction(null, null, true, false)
        // actions.addBlocks([{pos: player.pos1, item: {id: this.world.block_manager.NUM2.id}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        // actions.updatePos1Pos2(pos1, pos2)
        // chat.world.actions_queue.add(null, actions)
    }

    /**
     * Set first point of selecting region
     */
    async cmd_xyz1(chat, player, cmd, args) {
        args = chat.parseCMD(args, ['string', 'int', 'int', 'int']);
        const pos = new Vector(args[1], args[2], args[3]);
        const block = player.world.getBlock(pos);
        if(!block) {
            throw 'error_chunk_not_loaded';
        }
        player.pos1 = pos;
        let msg = `!langpos1 = ${player.pos1.x}, ${player.pos1.y}, ${player.pos1.z}`;
        if(player.pos2) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        this.updatePos1Pos2(chat, player)
    }

    /**
     * Set second point of selecting region
     */
    async cmd_xyz2(chat, player, cmd, args) {
        args = chat.parseCMD(args, ['string', 'int', 'int', 'int']);
        const pos = new Vector(args[1], args[2], args[3]);
        const block = player.world.getBlock(pos);
        if(!block) {
            throw 'error_chunk_not_loaded';
        }
        player.pos2 = pos;
        let msg = `!langpos2 = ${player.pos2.x}, ${player.pos2.y}, ${player.pos2.z}`;
        if(player.pos1) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        this.updatePos1Pos2(chat, player)
    }

    /**
     * Set block in region
     */
    async cmd_set(chat, player, cmd, args) {
        const quboid_set_type_id = QUBOID_SET_COMMANDS.indexOf(cmd) + 1
        const qi = this.getCuboidInfo(player)
        args = chat.parseCMD(args, ['string', 'string'])
        const palette = this.createBlocksPalette(args[1])
        await this.fillQuboid(chat, player, qi, palette, quboid_set_type_id)
    }

    /**
     * Copy all blocks in region to clipboard
     */
    async cmd_copy(chat, player: ServerPlayer, cmd, args) {
        if (this.checkSchematic(player, { pasting: true })) {
            return
        }
        this.clearSchematic(player, false)
        const qi = this.getCuboidInfo(player);
        const player_pos = player.state.pos.floored();
        player._world_edit_copy = await this.copy(qi, player_pos, chat.world);
        const msg = `!lang${player._world_edit_copy.blocks.size} block(s) copied`;
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

    async copy(quboid, pos : Vector, world : ServerWorld): Promise<TWorldEditCopy> {
        let blocks = new VectorCollector();
        let chunk_addr = new Vector(0, 0, 0);
        let chunk_addr_o = new Vector(Infinity, Infinity, Infinity);
        let bpos = new Vector(0, 0, 0);
        let chunk = null;
        const fluids = [];
        for(let x = 0; x < quboid.volx; x++) {
            for(let y = 0; y < quboid.voly; y++) {
                for(let z = 0; z < quboid.volz; z++) {
                    bpos.set(
                        quboid.pos1.x + x * quboid.signx,
                        quboid.pos1.y + y * quboid.signy,
                        quboid.pos1.z + z * quboid.signz
                    );
                    chunk_addr = world.chunkManager.grid.toChunkAddr(bpos, chunk_addr);
                    if(!chunk_addr_o.equal(chunk_addr)) {
                        chunk_addr_o.set(chunk_addr.x, chunk_addr.y, chunk_addr.z);
                        chunk = world.chunks.get(chunk_addr);
                        if(!chunk) {
                            throw 'error_chunk_not_loaded';
                        }
                    }
                    let block = chunk.getBlock(bpos);
                    let mat = block.material;
                    //if(mat.is_entity) {
                    //    continue;
                    //}
                    if(block.id < 0) {
                        throw 'error_get_block';
                    }
                    const item = {
                        id: block.id
                    } as IBlockItem;
                    const extra_data = block.extra_data;
                    if(extra_data) {
                        item.extra_data = extra_data;
                    }
                    if(mat.can_rotate) {
                        if(block.rotate) {
                            item.rotate = block.rotate;
                        }
                    }
                    bpos.subSelf(pos);
                    if (block.fluid != 0) {
                        fluids.push(bpos.x);
                        fluids.push(bpos.y);
                        fluids.push(bpos.z);
                        fluids.push(block.fluid);
                    }
                    blocks.set(bpos, item);
                }
            }
        }
        return {
            quboid,
            blocks,
            player_pos: pos.clone(),
            fluids
        };
    }

    //
    async cmd_building(chat, player, cmd, args) {
        if (this.checkSchematic(player, { pasting: true })) {
            return
        }
        if(!chat.world.admins.checkIsAdmin(player)) {
            throw 'error_not_permitted';
        }
        args = chat.parseCMD(args, ['string', 'string|float', 'string|float']);
        await this.building.onCmd(chat, player, cmd, args);
    }

    //
    async cmd_rotate(chat, player: ServerPlayer, cmd, args, copy_data) {
        if (this.checkSchematic(player, { pasting: true, loading: true })) {
            return
        }

        args = chat.parseCMD(args, ['string', 'int']);

        // Detect direction
        const dirs = {
            270: 1,     "-90": 1,
            180: 2,     "-180": 2,
            90: 3,      "-270": 3
        }
        let angle = args[1];
        const dir = dirs[angle]
        if(!dir) {
            throw 'error_no_interpolation';
        }

        // если есть загруженная этим пользователем схематика - изменить ее вращение
        if (this.schematic_info?.user_id === player.userId && this.schematic_info.state === SchematicState.LOADED) {
            this.schematic_info.rotate = ((this.schematic_info.rotate ?? 0) + dir) % 4
            chat.sendSystemChatMessageToSelectedPlayers(`!langThe schematic has been rotated`, player)
            return
        }

        if(!player._world_edit_copy && !copy_data) {
            throw 'error_not_copied_blocks';
        }

        //
        const data = copy_data ?? player._world_edit_copy;
        const new_blocks = new VectorCollector();

        for(let [bpos, item] of data.blocks.entries()) {
            const pos = new Vector(0, 0, 0).addByCardinalDirectionSelf(bpos, dir, false, false);
            item.pos = pos
            new_blocks.set(pos, item);
        }

        const rot = [[], [], [], []];

        // rotate blocks property
        BuildingTemplate.rotateBlocksProperty(new_blocks, rot, chat.world.block_manager, [dir])

        for(let i = 0; i < rot[dir].length; i++) {
            const item = rot[dir][i]
            const pos = item.pos
            delete(item.pos)
            new_blocks.set(pos, item)
        }

        data.blocks = new_blocks;

        const msg = `!lang${data.blocks.size} block(s) rotated`;
        chat.sendSystemChatMessageToSelectedPlayers(msg, player);

    }

    /**
     * Paste copied blocks
     */
    async cmd_paste(chat : ServerChat, player, cmd, args, copy_data = null) {
        if (this.checkSchematic(player, { pasting: true, loading: true })) {
            return
        }

        const player_pos : Vector = player.state.pos.floored();

        // если есть загруженная этим пользователем схематика - начать ее вставку
        const info = this.schematic_info
        if (info?.user_id === player.userId && info.state === SchematicState.LOADED) {
            if (this.checkWaitingWorker(player)) {
                return
            }
            info.pos = player_pos
            this.postWorkerMessage(['schem_update_info', { info }]) // обновить pos и rotate
            this.schematic_job = new SchematicJob(this, this.schematic_job_options)
            this.schematic_job.initNew(info)
            chat.sendSystemChatMessageToSelectedPlayers(`!langSchematic pasting started (use "/schem info" to see progress)`, player)
            return
        }

        if(!player._world_edit_copy && !copy_data) {
            throw 'error_not_copied_blocks';
        }
        const pn_set = performance.now();
        //
        const actions_list = new VectorCollector();
        const createWorldActions = (chunk_addr : Vector) : WorldAction => {
            const resp = new WorldAction(null, null, true, false)
            resp.blocks.options.chunk_addr = new Vector().copyFrom(chunk_addr)
            resp.blocks.options.ignore_equal = true
            return resp
        };
        //
        const grid = chat.world.chunkManager.grid
        const math = grid.math
        let affected_count = 0;
        //
        const data = copy_data ?? player._world_edit_copy;
        const chunk_addr_o = new Vector(Infinity, Infinity, Infinity);
        // const action_id = BLOCK_ACTION.CREATE;
        let chunk_addr = null;
        let actions : WorldAction = null
        //
        const getChunkActions = (chunk_addr : Vector) : WorldAction => {
            if(chunk_addr_o.equal(chunk_addr)) {
                return actions
            }
            chunk_addr_o.copyFrom(chunk_addr);
            actions = actions_list.get(chunk_addr);
            if(actions) {
                return actions
            }
            actions = createWorldActions(chunk_addr)
            actions_list.set(chunk_addr, actions)
            return actions
        }
        // blocks
        const AIR_BLOCK = new DBItemBlock(0)
        const _pos = new Vector()
        for(const [bpos, item] of data.blocks.entries()) {
            _pos.copyFrom(player_pos).addSelf(bpos)
            chunk_addr = grid.toChunkAddr(_pos, chunk_addr)
            actions = getChunkActions(chunk_addr)
            let clone : DBItemBlock = item.id ? item : AIR_BLOCK
            if(item.id != 0 && Object.keys(clone).length > 1) {
                clone = ObjectHelpers.deepCloneObject(item, 100, new DBItemBlock(item.id)) as DBItemBlock
            }
            actions.importBlock({posi: math.worldPosToChunkIndex(_pos), item: clone})
            affected_count++
        }
        // fluids
        if (data.fluids && data.fluids.length > 0) {
            const fluids = data.fluids;
            const grid : ChunkGrid = this.world.chunkManager.grid
            for (let i = 0; i < fluids.length; i += 4) {
                const x = fluids[i] + player_pos.x,
                      y = fluids[i + 1] + player_pos.y,
                      z = fluids[i + 2] + player_pos.z,
                      val = fluids[i + 3];
                chunk_addr = grid.getChunkAddr(x, y, z, chunk_addr);
                actions = getChunkActions(chunk_addr)
                actions.addFluids([x, y, z, val]);
                actions.fluidFlush = true
                affected_count++
            }
        }
        let cnt = 0;
        const notify = {
            user_id: player.session.user_id,
            total_actions_count: actions_list.size,
            message: '!langWorldEdit paste completed!'
        };
        for(const actions of actions_list.values()) {
            if(player) {
                if(cnt == 0 || cnt == actions_list.size - 1) {
                    actions.notify = notify;
                }
                cnt++
            }
            chat.world.actions_queue.add(null, actions);
        }
        const affected_count_formatted = affected_count.toLocaleString('us');
        const msg = `blocks_changed|${affected_count_formatted}`;
        const pn = Math.round((performance.now() - pn_set) * 10) / 10;
        const blocks_per_sec = Math.round(affected_count / (pn / 1000));
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        console.log(`world_edit: ${msg}`);
        console.log(`world_edit: cmd_paste time: ${pn} ms, chunks: ${actions_list.size}; blocks_per_sec: ${blocks_per_sec}`);
        const used3 = process.memoryUsage().heapUsed / 1024 / 1024
        console.log(`The script uses approximately ${Math.round(used3 * 100) / 100} MB`)
        console.log(process.memoryUsage())
    }

    // осушить
    async cmd_drain(chat : ServerChat, player, cmd, args) {
        return this.cmd_replace(chat, player, cmd, [null, 'water', 'air'], true)
    }

    // затопить
    async cmd_drown(chat : ServerChat, player, cmd, args) {
        const qi = this.getCuboidInfo(player)
        this.checkQuboidAffectedBlocksLimit(qi, QUBOID_SET_TYPE.FILL)
        const bm = chat.world.block_manager
        const water_block = bm.fromName('STILL_WATER')
        const newBlockFluidId = isFluidId(water_block.id)
        args = chat.parseCMD(args, ['string', 'string']);
        // const palette = this.createBlocksPalette(args[1])
        const pn_set        = performance.now()
        const grid          = chat.world.chunkManager.grid
        const bpos          = new Vector(0, 0, 0)
        const item_air      = new DBItemBlock(0)
        const chunk_addr    = new Vector(0, 0, 0)
        const chunk_addr_o  = new Vector(Infinity, Infinity, Infinity)
        let actions         = new WorldAction(null, null, true, false)
        //
        let chunk           = null
        let affected_count  = 0;
        //
        for(let x = 0; x < qi.volx; x++) {
            for(let y = 0; y < qi.voly; y++) {
                for(let z = 0; z < qi.volz; z++) {
                    bpos.set(qi.pos1.x + x * qi.signx, qi.pos1.y + y * qi.signy, qi.pos1.z + z * qi.signz)
                    grid.toChunkAddr(bpos, chunk_addr)
                    if(!chunk_addr_o.equal(chunk_addr)) {
                        chunk_addr_o.set(chunk_addr.x, chunk_addr.y, chunk_addr.z)
                        chunk = chat.world.chunks.get(chunk_addr)
                        if(!chunk) {
                            throw 'error_chunk_not_loaded'
                        }
                    }
                    if(affected_count % MAX_BLOCKS_PER_PASTE == 0) {
                        chat.world.actions_queue.add(null, actions);
                        actions = new WorldAction(null, null, true, false);
                    }
                    const block = chunk.getBlock(bpos)
                    const mat = block.material
                    let is_solid_for_fluid = mat.is_solid_for_fluid
                    if(is_solid_for_fluid) {
                        if(mat.id == bm.SNOW.id) {
                            is_solid_for_fluid = false
                            actions.addBlocks([
                                {
                                    pos: bpos.clone(), 
                                    item: item_air, 
                                    action_id: BLOCK_ACTION.CREATE
                                }
                            ])
                        }
                    }
                    if(!is_solid_for_fluid) {
                        affected_count++;
                        actions.addFluids([bpos.x, bpos.y, bpos.z, newBlockFluidId])
                    }
                }
            }
        }
        chat.world.actions_queue.add(null, actions);
        chat.sendSystemChatMessageToSelectedPlayers(`blocks_changed|${affected_count}`, [player.session.user_id]);
        console.log('world_edit.drown_quboid time took: ' + (performance.now() - pn_set));
    }

    async cmd_shearleaves(chat : ServerChat, player, cmd, args, drain: boolean = false) {
        const pn_set        = performance.now()
        const grid          = chat.world.chunkManager.grid
        const qi            = this.getCuboidInfo(player)
        // const repl_blocks   = this.createBlocksPalette(args[1])
        // const palette       = this.createBlocksPalette(args[2])
        const actions       = new WorldAction(null, null, true, false)
        const item_air      = new DBItemBlock(0)
        const chunk_addr    = new Vector(0, 0, 0)
        // const chunk_addr_o  = new Vector(Infinity, Infinity, Infinity)
        const bpos          = new Vector(0, 0, 0)
        //
        let chunk : ServerChunk = null
        let affected_count  = 0
        //
        for(let x = 0; x < qi.volx; x++) {
            for(let y = 0; y < qi.voly; y++) {
                for(let z = 0; z < qi.volz; z++) {
                    bpos.setScalar(
                        qi.pos1.x + x * qi.signx,
                        qi.pos1.y + y * qi.signy,
                        qi.pos1.z + z * qi.signz
                    );
                    grid.toChunkAddr(bpos, chunk_addr);
                    if(!chunk || !chunk.addr.equal(chunk_addr)) {
                        chunk = chat.world.chunks.get(chunk_addr)
                        if(!chunk) {
                            throw 'error_chunk_not_loaded';
                        }
                    }
                    const tblock = chunk.getBlock(bpos)
                    if(!tblock || tblock.id < 0) {
                        throw 'error_get_block'
                    }
                    const prev_block_mat = tblock.material
                    if(!prev_block_mat.is_leaves) {
                        continue
                    }
                    if(!tblock.extra_data?.sheared) {
                        const new_item = tblock.convertToDBItem()
                        if(!new_item.extra_data) {
                            new_item.extra_data = {}
                        }
                        new_item.extra_data.sheared = true
                        actions.addBlocks([
                            {
                                pos: bpos.clone(), 
                                item: new_item, 
                                action_id: BLOCK_ACTION.CREATE
                            }
                        ])
                        affected_count++
                    }
                }
            }
        }
        //
        chat.world.actions_queue.add(null, actions)
        let msg = `blocks_changed|${affected_count}`
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        console.log('world_edit.shearleaves time took: ' + (performance.now() - pn_set));
    }

    /**
     * Replace blocks in region to another
     */
    async cmd_replace(chat : ServerChat, player, cmd, args, drain: boolean = false) {
        const pn_set        = performance.now()
        const grid          = chat.world.chunkManager.grid
        const qi            = this.getCuboidInfo(player)
        const repl_blocks   = this.createBlocksPalette(args[1])
        const palette       = this.createBlocksPalette(args[2])
        const actions       = new WorldAction(null, null, true, false)
        const item_air      = new DBItemBlock(0)
        const chunk_addr    = new Vector(0, 0, 0)
        const chunk_addr_o  = new Vector(Infinity, Infinity, Infinity)
        const bpos          = new Vector(0, 0, 0)
        //
        let chunk           = null
        let affected_count  = 0
        //
        for(let x = 0; x < qi.volx; x++) {
            for(let y = 0; y < qi.voly; y++) {
                for(let z = 0; z < qi.volz; z++) {
                    bpos.setScalar(
                        qi.pos1.x + x * qi.signx,
                        qi.pos1.y + y * qi.signy,
                        qi.pos1.z + z * qi.signz
                    );
                    grid.toChunkAddr(bpos, chunk_addr);
                    if(!chunk_addr_o.equal(chunk_addr)) {
                        chunk_addr_o.set(chunk_addr.x, chunk_addr.y, chunk_addr.z);
                        chunk = chat.world.chunks.get(chunk_addr);
                        if(!chunk) {
                            throw 'error_chunk_not_loaded';
                        }
                    }
                    const prev_block = chunk.getBlock(bpos)
                    if(!prev_block || prev_block.id < 0) {
                        throw 'error_get_block'
                    }
                    const prev_block_mat = prev_block.material
                    if(prev_block_mat.is_entity) {
                        continue
                    }
                    for(let rb of repl_blocks.blocks) {
                        let replace = false;
                        if(rb.is_fluid) {
                            const oldBlockFluidValue = prev_block.fluid
                            if(oldBlockFluidValue > 0) {
                                const is_water = (oldBlockFluidValue & FLUID_TYPE_MASK) === FLUID_WATER_ID
                                const is_lava = (oldBlockFluidValue & FLUID_TYPE_MASK) === FLUID_LAVA_ID
                                const candidate_to_replace = (is_water && rb.is_water) || (is_lava && rb.is_lava)
                                if(prev_block_mat.id == 0) {
                                    replace = candidate_to_replace
                                } else if(drain) {
                                    replace = candidate_to_replace
                                }
                            }
                        } else {
                            replace = prev_block_mat.id == rb.block_id
                        }
                        if(replace) {
                            const new_item = palette.nextAsItem(prev_block)
                            const new_item_fluid_id = isFluidId(new_item.id)
                            if (new_item_fluid_id) {
                                actions.addFluids([bpos.x, bpos.y, bpos.z, new_item_fluid_id])
                                actions.addBlocks([
                                    {
                                        pos: bpos.clone(), 
                                        item: item_air, 
                                        action_id: BLOCK_ACTION.CREATE
                                    }
                                ])
                            } else {
                                if(!drain) {
                                    actions.addBlocks([
                                        {
                                            pos: bpos.clone(), 
                                            item: new_item, 
                                            action_id: BLOCK_ACTION.CREATE
                                        }
                                    ])
                                }
                                // if old block contain water
                                if(rb.is_fluid) {
                                    actions.addFluids([bpos.x, bpos.y, bpos.z, 0])
                                }
                            }
                            affected_count++
                            break
                        }
                    }
                }
            }
        }
        //
        chat.world.actions_queue.add(null, actions)
        let msg = `blocks_changed|${affected_count}`
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        console.log('world_edit.replace time took: ' + (performance.now() - pn_set));
    }

    //
    checkQuboidAffectedBlocksLimit(qi, quboid_set_type_id : QUBOID_SET_TYPE) {
        let total_count = qi.volume;
        const size = new Vector(qi.volx, qi.voly, qi.volz);
        const WALL_WIDTH = 1;
        switch(quboid_set_type_id) {
            // full
            case QUBOID_SET_TYPE.FILL: {
                // do nothing
                break;
            }
            // only walls
            case QUBOID_SET_TYPE.WALLS: {
                size.x -= WALL_WIDTH * 2;
                size.z -= WALL_WIDTH * 2;
                if(size.x > 0 && size.y > 0 && size.z > 0) {
                    total_count -= (size.x * size.y * size.z);
                }
                break;
            }
            // only faces
            case QUBOID_SET_TYPE.FACES: {
                size.x -= WALL_WIDTH * 2;
                size.y -= WALL_WIDTH * 2;
                size.z -= WALL_WIDTH * 2;
                if(size.x > 0 && size.y > 0 && size.z > 0) {
                    total_count -= (size.x * size.y * size.z);
                }
                break;
            }
        }
        if(total_count > MAX_SET_BLOCK) {
            throw 'error_volume_max_' + MAX_SET_BLOCK;
        }
    }

    //
    async fillQuboid(chat : ServerChat, player, qi, palette, quboid_set_type_id : QUBOID_SET_TYPE) {
        const pn_set        = performance.now()
        const grid          = chat.world.chunkManager.grid
        const bpos          = new Vector(0, 0, 0)
        const item_air      = new DBItemBlock(0)
        const chunk_addr    = new Vector(0, 0, 0)
        const chunk_addr_o  = new Vector(Infinity, Infinity, Infinity)
        let actions         = new WorldAction(null, null, true, false)
        //
        let chunk           = null
        let affected_count  = 0;
        this.checkQuboidAffectedBlocksLimit(qi, quboid_set_type_id)
        //
        for(let x = 0; x < qi.volx; x++) {
            for(let y = 0; y < qi.voly; y++) {
                for(let z = 0; z < qi.volz; z++) {
                    switch(quboid_set_type_id) {
                        // fill
                        case QUBOID_SET_TYPE.FILL: {
                            // do nothing
                            break;
                        }
                        // only walls
                        case QUBOID_SET_TYPE.WALLS: {
                            if((x > 0 && y >= 0 && z > 0) && (x < qi.volx - 1 && y < qi.voly && z < qi.volz - 1)) {
                                continue;
                            }
                            break;
                        }
                        // only faces
                        case QUBOID_SET_TYPE.FACES: {
                            if((x > 0 && y > 0 && z > 0) && (x < qi.volx - 1 && y < qi.voly - 1 && z < qi.volz - 1)) {
                                continue;
                            }
                            break;
                        }
                    }
                    bpos.set(qi.pos1.x + x * qi.signx, qi.pos1.y + y * qi.signy, qi.pos1.z + z * qi.signz)
                    grid.toChunkAddr(bpos, chunk_addr)
                    if(!chunk_addr_o.equal(chunk_addr)) {
                        chunk_addr_o.set(chunk_addr.x, chunk_addr.y, chunk_addr.z)
                        chunk = chat.world.chunks.get(chunk_addr)
                        if(!chunk) {
                            throw 'error_chunk_not_loaded'
                        }
                    }
                    const old_block = chunk.getBlock(bpos)
                    // const mat = old_block.material
                    affected_count++;
                    if(affected_count % MAX_BLOCKS_PER_PASTE == 0) {
                        chat.world.actions_queue.add(null, actions);
                        actions = new WorldAction(null, null, true, false);
                    }
                    const item = palette.nextAsItem();
                    const fluidId = isFluidId(item.id);
                    if (fluidId) {
                        actions.addFluids([bpos.x, bpos.y, bpos.z, fluidId])
                        actions.addBlocks([{pos: bpos.clone(), item: item_air, action_id: BLOCK_ACTION.CREATE}])
                    } else {
                        // need to clear old water values
                        if(old_block) {
                            const oldBlockFluidValue = old_block.fluid
                            if(oldBlockFluidValue > 0) {
                                actions.addFluids([bpos.x, bpos.y, bpos.z, 0])
                            }
                        }
                        actions.addBlocks([{pos: bpos.clone(), item, action_id: BLOCK_ACTION.CREATE}])
                    }
                }
            }
        }
        chat.world.actions_queue.add(null, actions);
        chat.sendSystemChatMessageToSelectedPlayers(`blocks_changed|${affected_count}`, [player.session.user_id]);
        console.log('world_edit.fill_quboid time took: ' + (performance.now() - pn_set));
    }

    // Return quboid info
    getCuboidInfo(obj) {
        if(!obj.pos1) {
            throw 'error_pos1_not_defined';
        }
        if(!obj.pos2) {
            throw 'error_pos2_not_defined';
        }
        const volume = obj.pos1.volume(obj.pos2);
        if(volume < 1) {
            throw 'error_volume_0';
        }
        return {
            pos1: obj.pos1.clone(),
            volume: volume,
            volx: Math.abs(obj.pos1.x - obj.pos2.x) + 1,
            voly: Math.abs(obj.pos1.y - obj.pos2.y) + 1,
            volz: Math.abs(obj.pos1.z - obj.pos2.z) + 1,
            signx: obj.pos1.x > obj.pos2.x ? -1 : 1,
            signy: obj.pos1.y > obj.pos2.y ? -1 : 1,
            signz: obj.pos1.z > obj.pos2.z ? -1 : 1
        };
    }

    //set 10%0,20%dirt
    //set 10%dirt,gold_block
    createBlocksPalette(args) {
        const bm = this.world.block_manager
        args = new String(args);
        const blocks = args.trim().split(',')
        const blockChances : IBlockChance[] = []
        // Parse blocks pattern
        for(let a of blocks) {
            let chance = 1;
            let name = null;
            if(/[0-9]+(\\.[0-9]*)?%.*/.test(a)) {
                a = a.split('%');
                chance = parseFloat(a[0]);
                name = a[1];
            } else {
                name = a;
            }
            if(name.toLowerCase() == 'water') {
                name = 'still_water'
            }
            if(name.toLowerCase() == 'lava') {
                name = 'still_lava'
            }
            let block_id = null
            if(isNaN(name)) {
                name = name.toUpperCase()
            } else {
                block_id = parseInt(name)
                name = null
            }
            blockChances.push({
                block_id: block_id,
                name: name,
                chance: chance,
            } as IBlockChance)
        }
        // Check names and validate blocks
        const fake_orientation = new Vector(0, 1, 0)
        const fake_pos = {...new Vector(0, 0, 0), n: new Vector(0, 0, 0), point: undefined} as IVectorPoint;
        for(let item of blockChances) {
            const b = item.name ? bm.fromName(item.name) : bm.fromId(item.block_id)
            if(b.is_dummy) throw 'error_invalid_block'
            if(b.deprecated) throw 'error_block_is_deprecated'
            if(b.item || b.previous_part || ['extruder', 'text', 'painting'].indexOf(b.style_name) >= 0) throw 'error_this_block_cannot_be_setted';
            //
            const block_id = b.id;
            const extra_data = bm.makeExtraData(b, fake_pos, fake_orientation, null);
            if(extra_data) {
                item.extra_data = extra_data
            }
            if(b.can_rotate) {
                item.rotate = fake_orientation
            }
            item.block_id = block_id
            item.is_fluid = b.is_fluid
            item.is_lava = b.is_lava
            item.is_water = b.is_water
            item.material = b
            item.name = b.name
        }
        // Random fill
        let max = 0;
        for(let block of blockChances) {
            max += block.chance;
        }
        let i = 0;
        for(let block of blockChances) {
            let v = block.chance / max;
            i += v;
            block.chance = i;
        }
        //
        return {
            blocks: blockChances,
            next: function() {
                const r = Math.random();
                for(let block of this.blocks) {
                    if (r <= block.chance) {
                        return block
                    }
                }
                throw 'error_proportional_fill_pattern'
            },
            nextAsItem: function(prev? : any) : DBItemBlock {
                const next = this.next()
                const resp = {
                    id: next.block_id
                } as IBlockItem;
                if(next.extra_data) {
                    resp.extra_data = next.extra_data
                }
                if(next.rotate) {
                    resp.rotate = next.rotate
                }
                if(prev) {
                    if(prev.material.same && next.material.same) {
                        // Copy properties if block same type with previous
                        if(prev.material.same.id == next.material.same.id) {
                            const same = prev.material.same
                            // 1. copy extra_data
                            if((same.properties & BLOCK_SAME_PROPERTY.EXTRA_DATA) == BLOCK_SAME_PROPERTY.EXTRA_DATA) {
                                const prev_extra_data = prev.extra_data
                                if(prev_extra_data) {
                                    resp.extra_data = JSON.parse(JSON.stringify(prev_extra_data))
                                }
                            }
                            // 2. copy rotate
                            if((same.properties & BLOCK_SAME_PROPERTY.ROTATE) == BLOCK_SAME_PROPERTY.ROTATE) {
                                const prev_rotate = prev.rotate
                                if(prev_rotate) {
                                    resp.rotate = new Vector().copyFrom(prev_rotate)
                                }
                            }
                        }
                    }
                }
                //
                return resp
            }
        };
    }

    // schematic commands
    async cmd_schematic(chat: ServerChat, player: ServerPlayer, cmd: string, args: any[]) {

        const options = Array.from(Object.keys(SCHEMATIC_JOB_OPTIONS)).join('|')
        if (args.length === 1) {
            const lines = [
                '/schem load <name> [true|false] - the 2nd parameter - read air (default = true)',
                `/schem options ${options} - sets options by name. It affects speed, memory and responsiveness.`,
                '/schem info'
            ]
            chat.sendSystemChatMessageToSelectedPlayers('!lang\n' + lines.join('\n'), player)
        }

        const {user_id, username} = player.session
        const action = args[1];
        let msg: string | null = null;
        //
        switch(action) {
            case 'save': {
                throw 'error_not_implemented'
            }
            case 'options': {
                const name = args[3]
                let msg: string
                if (SCHEMATIC_JOB_OPTIONS[name]) {
                    this.schematic_job_options = SCHEMATIC_JOB_OPTIONS[name]
                    msg = `Schematic options are set to "${name}"`
                } else {
                    msg = `Unknown schematic options name "${name}", use: ${options}"`
                }
                chat.sendSystemChatMessageToSelectedPlayers('!lang' + msg, player)
                break
            }
            case 'inf':
            case 'info': {
                let result: string
                const info = this.schematic_info ?? this.world.state.schematic_job
                if (this.schematic_info) {
                    const by = (user_id === player.userId) ? 'you' : `@${username}`
                    const loaded = (this.schematic_info.state === SchematicState.LOADING) ? 'being loaded' : 'loaded'
                    result = `Schematic "${info.orig_file_name}" is ${loaded} by ${by}.`
                    if (info.state === SchematicState.LOADED) {
                        const size = new Vector(info.size)
                        result += ` Blocks: ${size.volume()}, size: ${size.toHash()}, offset: ${new Vector(info.offset).toHash()}, read_air=${info.read_air}`
                        if (info.rotate) {
                            result += `, rotation=${info.rotate * 90}`
                        }
                        result += '.'
                        if (info.file_cookie.use_external_parser) {
                            result += ' Using the old parser.'
                        } else if (info.file_cookie.tmp_file_ctimeMs) {
                            result += ' Using a temporary file.'
                        }
                    }
                } else {
                    result = info
                        ? `Pasting of schematic "${info.orig_file_name}" will resume automatically.`
                        : `No schematic is loaded.`
                }
                if (this.schematic_job) {
                    const aabb = this.schematic_job.schemAABB
                    result += `\nPasting progress: ${this.schematic_job.progressToString()}, AABB: ${aabb.getMin()}, ${aabb.getMax()}.`
                }
                if (this.waiting) {
                    result += `\nWaiting for "${this.waiting.text}" command to finish.`
                }
                chat.sendSystemChatMessageToSelectedPlayers('!lang' + result, player)
                break
            }
            case 'load': {
                if (this.checkWaitingWorker(player) || this.checkSchematic(player, {anyPlayer: true, pasting: true})) {
                    break
                }
                args = chat.parseCMD(args, ['string', 'string', 'string', '?boolean'])
                player._world_edit_copy = null  // если у него было что-то в буфере - очистить
                this.schematic_info = {
                    user_id,
                    username,
                    state: SchematicState.LOADING,
                    orig_file_name: args[2],
                    read_air: !!(args[3] ?? false),
                    rotate: 0,
                    file_cookie: {}
                }
                this.postWorkerMessage(['schem_load', {
                    info: this.schematic_info,
                    max_memory_file_size: this.schematic_job_options.max_memory_file_size
                }], action)
                break
            }
            default: {
                msg = 'error_invalid_command';
                break;
            }
        }
        if (msg) {
            chat.sendSystemChatMessageToSelectedPlayers(msg, player);
        }
    }

    /** @return true воркер занят, пока нельзя принимать команды (состояние загруженой схематики может измениться) */
    private checkWaitingWorker(player: ServerPlayer): boolean {
        if (this.waiting) {
            this.chat.sendSystemChatMessageToSelectedPlayers(`!langThe previous command "${this.waiting.text}" hasn't finished. Try again later.`, player)
            return true
        }
        return false
    }

    /**
     * @return true если выполняется или скоро начнется вставка схематики, и другие команды
     *   не должны выполняться. Также отпарвляет об этом сообщение игроку.
     *   !Игнорирует, если просто загружена схематика, но не заказана ее встака!
     */
    private checkSchematic(player: ServerPlayer, options: ICheckSchematicOptions): boolean {
        let info = this.world.state.schematic_job
        if (info && (options.anyPlayer || info.user_id === player.userId)) {
            if (options.pasting) {
                const job = this.schematic_job
                let msg = job
                    ? `!langPasting of schematic "${info.orig_file_name}" is in progress, ${
                        Math.floor(job.total_inserted_chunks / info.job.chunks_count * 100)}% completed.`
                    : `!langPasting of schematic "${info.orig_file_name}" is about to resume.`
                msg += info.user_id === player.userId
                    ? ` Wait until it finishes or enter /clearclipboard to cancel it.`
                    : ` Wait until it finishes.`
                this.chat.sendSystemChatMessageToSelectedPlayers(msg, player)
                return true
            }
            // если загружается или ожидает начала загрузки
            if (options.loading && info.state < SchematicState.LOADED) {
                this.chat.sendSystemChatMessageToSelectedPlayers(`!langThe schematic hasn't loaded yet. Wait until it finishes.`, player)
                return true
            }
        }
        return false
    }

    /** Останавливает и удаляет процесс вставки схематики. Не выгружает из памяти саму схематику. */
    clearSchematicJob(): void {
        if (this.schematic_job) {
            this.world.sendSelected([{
                name: ServerClient.CMD_PROGRESSBAR,
                data: { text: '', percent: null }
            }], [this.schematic_info.user_id])
            this.schematic_job.clearActions()
            this.schematic_job = null
        }
        delete this.world.state.schematic_job
    }

    /**
     * Удаляет схематику, если она загружена указанным игроком. Также отменяет/останавлиет ее встаку.
     * @return true если схематика была
     */
    clearSchematic(player?: ServerPlayer, notify?: boolean): boolean {
        const info = this.world.state.schematic_job ?? this.schematic_info
        if (info && (!player || info?.user_id === player.userId)) {
            this.clearSchematicJob()
            // если загружена или загружается - надо очистить в воркере
            if (this.schematic_info?.state === SchematicState.LOADING || this.schematic_info?.state === SchematicState.LOADED) {
                this.schematic_info.state = SchematicState.UNLOADING
                this.postWorkerMessage(['schem_clear', { user_id: player?.userId, notify }], 'clearing schematic')
            } else {
                this.schematic_info = null
                if (notify) {
                    this.chat.sendSystemChatMessageToSelectedPlayers('clipboard_cleared', player)
                }
            }
            return true
        }
        return false
    }

}