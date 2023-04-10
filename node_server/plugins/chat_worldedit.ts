import { Vector, VectorCollector } from "@client/helpers.js";
import {WorldAction} from "@client/world_action.js";
import { ServerClient } from "@client/server_client.js";
import {FLUID_LAVA_ID, FLUID_TYPE_MASK, FLUID_WATER_ID, isFluidId} from "@client/fluid/FluidConst.js";
import { WorldEditBuilding } from "@client/plugins/worldedit/building.js";
import { BuildingTemplate } from "@client/terrain_generator/cluster/building_template.js";
import { BLOCK_SAME_PROPERTY, DBItemBlock } from "@client/blocks.js";
import type { ServerWorld } from "server_world";
import type { ChunkGrid } from "@client/core/ChunkGrid";
import type { ServerChat } from "server_chat";

const MAX_SET_BLOCK         = 250000 * 4
const MAX_BLOCKS_PER_PASTE  = 10000
const QUBOID_SET_COMMANDS = ['/set', '/walls', '/faces'];

enum QUBOID_SET_TYPE {
    FILL = 1,
    WALLS = 2,
    FACES = 3,
}

export default class WorldEdit {
    id: number;
    worker: Worker;
    world: ServerWorld;
    chat: any;
    building: WorldEditBuilding;
    commands: Map<any, any>;

    static targets = ['chat'];

    constructor() {
        this.id = performance.now()
    }

    initWorker() {
        this.worker = new Worker(globalThis.__dirname + '../../www/js/plugins/worldedit/worker.js');
        const onmessage = (data) => {
            if(data instanceof MessageEvent) {
                data = data.data
            }
            // console.log('worker -> chat_worldedit', data)
            const cmd = data[0];
            const args = data[1];
            switch(cmd) {
                case 'schem_loaded': {
                    const user_id = args.args.user_id
                    const player = this.world.players.get(user_id)
                    if(player) {
                        player._world_edit_copy = args._world_edit_copy
                        player._world_edit_copy.blocks = new VectorCollector(player._world_edit_copy.blocks.list, player._world_edit_copy.blocks.size)
                        this.chat.sendSystemChatMessageToSelectedPlayers(args.msg, [user_id])
                    }
                    break;
                }
                case 'schem_error': {
                    const user_id = args.args.user_id
                    const player = this.world.players.get(user_id)
                    if(player) {
                        // player.sendError(args.e)
                        this.chat.sendSystemChatMessageToSelectedPlayers(args.e, [user_id])
                    }
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
    }

    // postWorkerMessage
    postWorkerMessage(cmd) {
        if(!this.worker) {
            this.initWorker()
        }
        this.worker.postMessage(cmd)
    }

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        
        if(!this.world) {
            this.chat = chat
            this.world = chat.world
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
    async cmd_clearclipboard(chat, player, cmd, args) {
        delete(player._world_edit_copy);
        chat.sendSystemChatMessageToSelectedPlayers('clipboard_cleared', [player.session.user_id]);
    }

    /**
     * Reset selected region
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_desel(chat, player, cmd, args) {
        player.pos1 = null;
        player.pos2 = null;
    }

    /**
     * Set first point of selecting region
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_pos1(chat, player, cmd, args) {
        player.pos1 = player.state.pos.floored();
        let msg = `pos1 = ${player.pos1.x}, ${player.pos1.y}, ${player.pos1.z}`;
        if(player.pos2) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        //
        let actions = new WorldAction(null, null, true, false/*, false*/);
        actions.addBlocks([{pos: player.pos1, item: {id: this.world.block_manager.NUM1.id}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        chat.world.actions_queue.add(null, actions);
    }

    /**
     * Set second point of selecting region
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_pos2(chat, player, cmd, args) {
        player.pos2 = player.state.pos.floored();
        let msg = `pos2 = ${player.pos2.x}, ${player.pos2.y}, ${player.pos2.z}`;
        if(player.pos1) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        //
        let actions = new WorldAction(null, null, true, false/*, false*/);
        actions.addBlocks([{pos: player.pos2, item: {id: this.world.block_manager.NUM2.id}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        chat.world.actions_queue.add(null, actions);
    }

    /**
     * Set first point of selecting region
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_xyz1(chat, player, cmd, args) {
        args = chat.parseCMD(args, ['string', 'int', 'int', 'int']);
        const pos = new Vector(args[1], args[2], args[3]);
        const block = player.world.getBlock(pos);
        if(!block) {
            throw 'error_chunk_not_loaded';
        }
        player.pos1 = pos;
        let msg = `pos1 = ${player.pos1.x}, ${player.pos1.y}, ${player.pos1.z}`;
        if(player.pos2) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

    /**
     * Set second point of selecting region
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_xyz2(chat, player, cmd, args) {
        args = chat.parseCMD(args, ['string', 'int', 'int', 'int']);
        const pos = new Vector(args[1], args[2], args[3]);
        const block = player.world.getBlock(pos);
        if(!block) {
            throw 'error_chunk_not_loaded';
        }
        player.pos2 = pos;
        let msg = `pos2 = ${player.pos2.x}, ${player.pos2.y}, ${player.pos2.z}`;
        if(player.pos1) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
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
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_copy(chat, player, cmd, args) {
        const qi = this.getCuboidInfo(player);
        const player_pos = player.state.pos.floored();
        player._world_edit_copy = await this.copy(qi, player_pos, chat.world);
        const msg = `${player._world_edit_copy.blocks.size} block(s) copied`;
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

    async copy(quboid, pos : Vector, world : ServerWorld) {
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
        if(!chat.world.admins.checkIsAdmin(player)) {
            throw 'error_not_permitted';
        }
        args = chat.parseCMD(args, ['string', 'string', 'string']);
        await this.building.onCmd(chat, player, cmd, args);
    }

    //
    async cmd_rotate(chat, player, cmd, args, copy_data) {

        if(!player._world_edit_copy && !copy_data) {
            throw 'error_not_copied_blocks';
        }

        args = chat.parseCMD(args, ['string', 'int']);

        // Detect direction
        const dirs = {
            270: 1,
            180: 2,
            90: 3
        }
        let angle = args[1];
        const dir = dirs[angle]
        if(!dir) {
            throw 'error_no_interpolation';
        }

        //
        const data = copy_data ?? player._world_edit_copy;
        const new_blocks = new VectorCollector();

        for(let [bpos, item] of data.blocks.entries()) {
            const pos = new Vector(0, 0, 0).addByCardinalDirectionSelf(bpos, dir, false, false);
            item.block_id = item.id;
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
            delete(item.block_id)
            new_blocks.set(pos, item)
        }

        data.blocks = new_blocks;

        const msg = `${data.blocks.size} block(s) rotated`;
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);

    }

    /**
     * Paste copied blocks
     */
    async cmd_paste(chat : ServerChat, player, cmd, args, copy_data = null) {
        if(!player._world_edit_copy && !copy_data) {
            throw 'error_not_copied_blocks';
        }
        const pn_set = performance.now();
        //
        const actions_list = new VectorCollector();
        const createwWorldActions = () => {
            const resp = new WorldAction(null, null, true, false);
            return resp;
        };
        //
        const grid = chat.world.chunkManager.grid
        const player_pos = player.state.pos.floored();
        let affected_count = 0;
        //
        const data = copy_data ?? player._world_edit_copy;
        const chunk_addr_o = new Vector(Infinity, Infinity, Infinity);
        const action_id = ServerClient.BLOCK_ACTION_CREATE;
        let chunk_addr = null;
        let actions = null;
        //
        const getChunkActions = (chunk_addr) => {
            if(chunk_addr_o.equal(chunk_addr)) {
                return actions
            }
            chunk_addr_o.copyFrom(chunk_addr);
            actions = actions_list.get(chunk_addr);
            if(actions) {
                return actions
            }
            actions = createwWorldActions()
            actions_list.set(chunk_addr, actions)
            return actions
        }
        // blocks
        for(const [bpos, item] of data.blocks.entries()) {
            const pos = player_pos.add(bpos)
            chunk_addr = grid.toChunkAddr(pos, chunk_addr)
            actions = getChunkActions(chunk_addr)
            actions.addBlock({pos, item, action_id})
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
            message: 'WorldEdit paste completed!'
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
                                    action_id: ServerClient.BLOCK_ACTION_CREATE
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
                    bpos.set(
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
                                        action_id: ServerClient.BLOCK_ACTION_CREATE
                                    }
                                ])
                            } else {
                                if(!drain) {
                                    actions.addBlocks([
                                        {
                                            pos: bpos.clone(), 
                                            item: new_item, 
                                            action_id: ServerClient.BLOCK_ACTION_CREATE
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
                        actions.addBlocks([{pos: bpos.clone(), item: item_air, action_id: ServerClient.BLOCK_ACTION_CREATE}])
                    } else {
                        // need to clear old water values
                        if(old_block) {
                            const oldBlockFluidValue = old_block.fluid
                            if(oldBlockFluidValue > 0) {
                                actions.addFluids([bpos.x, bpos.y, bpos.z, 0])
                            }
                        }
                        actions.addBlocks([{pos: bpos.clone(), item, action_id: ServerClient.BLOCK_ACTION_CREATE}])
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
        const fake_pos = {...new Vector(0, 0, 0), n: new Vector(0, 0, 0)};
        for(let item of blockChances) {
            const b = item.name ? bm.fromName(item.name) : bm.fromId(item.block_id)
            if(!b || b.id < 0) throw 'error_invalid_block'
            if(b.deprecated) throw 'error_block_is_deprecated'
            if(b.item || b.next_part || b.previous_part || ['extruder', 'text', 'painting'].indexOf(b.style_name) >= 0) throw 'error_this_block_cannot_be_setted';
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
    async cmd_schematic(chat, player, cmd, args) {
        args = chat.parseCMD(args, ['string', 'string', 'string']);
        const action = args[1];
        let msg = null;
        //
        switch(action) {
            case 'save': {
                throw 'error_not_implemented'
            }
            case 'load': {
                const filename = args[2]
                const user_id = player.session.user_id
                this.postWorkerMessage(['schem_load', {filename, user_id}])
                return
                // let p = performance.now();
                // const reader = new SchematicReader();
                // const schem = await reader.read(args[2]);
                // if(reader.blocks.size > 0) {
                //     player._world_edit_copy = {
                //         quboid: null,
                //         blocks: reader.blocks,
                //         fluids: reader.fluids,
                //         player_pos: null
                //     };
                // }
                // p = Math.round((performance.now() - p) * 1000) / 1000000;
                // console.log('schematic version', schem.version);
                // const size = new Vector(schem.size).toHash();
                // msg = `... loaded (${reader.blocks.size} blocks, size: ${size}, load time: ${p} sec). Version: ${schem.version}. Paste it with //paste`;
                break;
            }
            default: {
                msg = 'error_invalid_command';
                break;
            }
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

}