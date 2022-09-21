import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../www/js/chunk_const.js";
import {ServerClient} from "../www/js/server_client.js";
import {Vector, VectorCollector} from "../www/js/helpers.js";
import {BLOCK} from "../www/js/blocks.js";
import { newTypedBlocks } from "../www/js/typed_blocks3.js";
import { WorldAction } from "../www/js/world_action.js";
import { NO_TICK_BLOCKS } from "../www/js/constant.js";
import { compressWorldModifyChunk, decompressWorldModifyChunk } from "../www/js/compress/world_modify_chunk.js";
import { MobGenerator } from "./mob/generator.js";

export const CHUNK_STATE_NEW               = 0;
export const CHUNK_STATE_LOADING           = 1;
export const CHUNK_STATE_LOADED            = 2;
export const CHUNK_STATE_BLOCKS_GENERATED  = 3;
export const CHUNK_STATE_UNLOADED          = 4;
//

// Ticking block
class TickingBlock {

    #chunk;

    constructor(chunk) {
        this.#chunk     = chunk;
        this.pos        = new Vector(0, 0, 0);
        // this.tblock     = null;
        this.ticking    = null;
        this.ticker     = null;
        this.fluidBuf   = null;
    }

    setState(pos_index) {
        this.pos.fromFlatChunkIndex(pos_index).addSelf(this.#chunk.coord);
        // this.tblock = this.#chunk.getBlock(this.pos);
        const tblock = this.tblock;
        if(!tblock || !tblock.material.ticking || !tblock.extra_data || ('notick' in tblock.extra_data)) {
            return false;
        }
        this.ticking = tblock.material.ticking;
        this.ticker = this.#chunk.world.tickers.get(this.ticking.type);
        if(!this.ticker) {
            console.error(`Invalid ticking type: ${this.ticking.type}`);
            return false;
        }
        return true;
    }

    get tblock() {
        return this.#chunk.getBlock(this.pos);
    }

}

// TickingBlockManager
class TickingBlockManager {

    #chunk;
    #pos = new Vector(0, 0, 0);

    constructor(chunk) {
        this.#chunk = chunk;
        this.v = new TickingBlock(chunk);
        this.blocks = new Set();
    }

    get chunk() {
        return this.#chunk;
    }

    // addTickingBlock
    add(pos_world) {
        const pos_index = pos_world.getFlatIndexInChunk();
        this.blocks.add(pos_index);
        this.#chunk.world.chunks.addTickingChunk(this.#chunk.addr);
    }

    // deleteTickingBlock
    delete(pos_world) {
        const pos_index = pos_world.getFlatIndexInChunk();
        this.blocks.delete(pos_index);
        if(this.blocks.size == 0) {
            this.#chunk.world.chunks.removeTickingChunk(this.#chunk.addr);
        }
    }

    // tick
    tick(tick_number) {

        const world             = this.#chunk.world;
        const updated_blocks    = [];
        const ignore_coords     = new VectorCollector();
        const check_pos         = new Vector(0, 0, 0);
        const v                 = this.v;

        //
        for(const pos_index of this.blocks) {
            if(!v.setState(pos_index)) {
                this.delete(v.pos);
                continue;
            }
            const upd_blocks = v.ticker.call(this, tick_number + pos_index, world, this.#chunk, v, check_pos, ignore_coords);
            if(Array.isArray(upd_blocks)) {
                updated_blocks.push(...upd_blocks);
            }
        }

        //
        if(updated_blocks.length > 0) {
            const actions = new WorldAction(null, this.#chunk.world, false, false);
            actions.addBlocks(updated_blocks);
            world.actions_queue.add(null, actions);
        }

    }

}

// Server chunk
export class ServerChunk {

    constructor(world, addr) {
        this.world          = world;
        this.size           = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        this.addr           = new Vector(addr);
        this.coord          = this.addr.mul(this.size);
        this.connections    = new Map();
        this.preq           = new Map();
        this.modify_list    = {};
        this.mobs           = new Map();
        this.drop_items     = new Map();
        this.ticking_blocks = new TickingBlockManager(this);
        this.options        = {};
        if(['biome2'].indexOf(world.info.generator.id) >= 0) {
            this.mobGenerator   = new MobGenerator(this);
        }
        //if(['npc'].indexOf(world.info.generator.id) >= 0) {
        //    this.mobGenerator = new MobGenerator(this);
        //}
        this.setState(CHUNK_STATE_NEW);
    }

    // Set chunk init state
    setState(state_id) {
        this.load_state = state_id;
        const chunkManager = this.getChunkManager();
        if (chunkManager) {
            chunkManager.chunkStateChanged(this, state_id);
        }
    }

    // generateMobs...
    generateMobs() {
        // Generate mobs
        if(this.mobGenerator) {
            this.mobGenerator.generate();
            this.mobGenerator = null;
        }
    }

    // Load state from DB
    load() {
        if(this.load_state > CHUNK_STATE_NEW) {
            return;
        }
        this.setState(CHUNK_STATE_LOADING);
        //
        const afterLoad = ([ml, fluid]) => {
            if(!ml.obj && ml.compressed) {
                ml.obj = decompressWorldModifyChunk(ml.compressed)
            }
            this.modify_list = ml;
            this.ticking = new Map();
            this.setState(CHUNK_STATE_LOADED);
            // Send requet to worker for create blocks structure
            this.world.chunks.postWorkerMessage(['createChunk',
                [
                    {
                        update:         true,
                        addr:           this.addr,
                        modify_list:    ml
                    }
                ]
            ]);
            // Разошлем чанк игрокам, которые его запрашивали
            if(this.preq.size > 0) {
                this.sendToPlayers(Array.from(this.preq.keys()));
                this.preq.clear();
            }

            this.fluidBuf = fluid;
        };

        const loadCMPromise = new Promise((resolve, reject) => {
            if(this.world.chunkHasModifiers(this.addr)) {
                resolve(this.world.db.loadChunkModifiers(this.addr))
            } else {
                resolve({})
            }
        });

        Promise.all([loadCMPromise, this.world.db.fluid.loadChunkFluid(this.addr)]).then(afterLoad);
    }

    // Add player connection
    addPlayer(player) {
        this.connections.set(player.session.user_id, player);
        player.addChunk(this);
    }

    // Добавление игрока, которому после прогрузки чанка нужно будет его отправить
    addPlayerLoadRequest(player) {
        if(this.load_state < CHUNK_STATE_LOADED) {
            return this.preq.set(player.session.user_id, player);
        }
        this.sendToPlayers([player.session.user_id]);
        if(this.load_state > CHUNK_STATE_LOADED) {
            this.sendMobs([player.session.user_id]);
            this.sendDropItems([player.session.user_id]);
        }
    }

    // Remove player from chunk
    removePlayer(player) {
        if(this.connections.has(player.session.user_id)) {
            this.connections.delete(player.session.user_id);
            // Unload mobs for player
            // @todo перенести выгрузку мобов на сторону игрока, пусть сам их выгружает, в момент выгрузки чанков
            if(this.mobs.size > 0) {
                const packets = [{
                    name: ServerClient.CMD_MOB_DELETE,
                    data: Array.from(this.mobs.keys())
                }];
                this.world.sendSelected(packets, [player.session.user_id], []);
            }
            if(this.drop_items.size > 0) {
                const packets = [{
                    name: ServerClient.CMD_DROP_ITEM_DELETED,
                    data: Array.from(this.drop_items.keys())
                }];
                this.world.sendSelected(packets, [player.session.user_id], []);
            }
        }
        if(this.connections.size < 1) {
            // помечает чанк невалидным, т.к. его больше не видит ни один из игроков
            // в следующем тике мира, он будет выгружен
            this.world.chunks.invalidate(this);
        }
    }

    // Add mob
    addMob(mob) {
        this.mobs.set(mob.id, mob);
        const packets = [{
            name: ServerClient.CMD_MOB_ADD,
            data: [mob]
        }];
        this.sendAll(packets);
    }

    // Add drop item
    addDropItem(drop_item) {
        this.drop_items.set(drop_item.entity_id, drop_item);
        let packets = [{
            name: ServerClient.CMD_DROP_ITEM_ADDED,
            data: [drop_item]
        }];
        this.sendAll(packets);
    }

    // Send chunk for players
    sendToPlayers(player_ids) {
        // @CmdChunkState
        const name = ServerClient.CMD_CHUNK_LOADED;
        const data = {addr: this.addr, modify_list: {}};
        const ml = this.modify_list;
        if(!ml.compressed && ml.obj) {
            this.compressModifyList();
        }
        if(ml.compressed) {
            data.modify_list.compressed = ml.compressed.toString('base64');
        } else {
            data.modify_list.obj = ml.obj;
        }
        return this.world.sendSelected([{name, data}], player_ids, []);
    }

    // Compress modify list
    compressModifyList() {
        const ml = this.modify_list;
        if(ml.obj) {
            ml.compressed = Buffer.from(compressWorldModifyChunk(ml.obj, true));
            this.world.db.saveCompressedWorldModifyChunk(this.addr, ml.compressed);
        }
    }

    sendMobs(player_user_ids) {
        // Send all mobs in this chunk
        if (this.mobs.size < 1) {
            return;
        }
        let packets_mobs = [{
            name: ServerClient.CMD_MOB_ADD,
            data: []
        }];
        for(const [_, mob] of this.mobs) {
            packets_mobs[0].data.push(mob);
        }
        this.world.sendSelected(packets_mobs, player_user_ids, []);
    }

    sendFluid(buf) {
        const packets = [{
            name: ServerClient.CMD_FLUID_UPDATE,
            data: {
                addr: this.addr,
                buf: Buffer.from(buf).toString('base64')
            }
        }];
        this.sendAll(packets, []);
    }

    sendDropItems(player_user_ids) {
        // Send all drop items in this chunk
        if (this.drop_items.size < 1) {
            return;
        }
        let packets = [{
            name: ServerClient.CMD_DROP_ITEM_ADDED,
            data: []
        }];
        for(const [_, drop_item] of this.drop_items) {
            packets[0].data.push(drop_item);
        }
        this.world.sendSelected(packets, player_user_ids, []);
    }

    // onBlocksGenerated ... Webworker callback method
    async onBlocksGenerated(args) {
        const chunkManager = this.getChunkManager();
        if (!chunkManager) {
            return;
        }
        if(this.addr.equal(new Vector(-10,0,-1))) {
            let ids = [];
            for(let i = 0; i < args.tblocks.id.length; i++) {
                let id = args.tblocks.id[i];
                if(id > 0) ids.push(id);
            }
        }
        this.tblocks = newTypedBlocks(this.coord, this.size);
        chunkManager.dataWorld.addChunk(this);
        if(args.tblocks) {
            this.tblocks.restoreState(args.tblocks);
        }
        //
        this.mobs = await this.world.db.mobs.loadInChunk(this.addr, this.size);
        this.drop_items = await this.world.db.loadDropItems(this.addr, this.size);
        // fluid
        if(this.load_state === CHUNK_STATE_UNLOADED) {
            return;
        }
        let fluidBuf = this.fluidBuf;
        this.fluidBuf = null;
        if(fluidBuf) {
            this.fluid.loadDbBuffer(fluidBuf, true);
        } else {
            if (this.fluid.isNotEmpty()) {
                fluidBuf = this.fluid.saveDbBuffer();
                //TODO: do we have to wait for this? make sure there's no double-save
                await this.world.db.fluid.saveChunkFluid(this.addr, fluidBuf);
            }
        }
        //
        if(this.load_state === CHUNK_STATE_UNLOADED) {
            return;
        }
        this.setState(CHUNK_STATE_BLOCKS_GENERATED);
        // Scan ticking blocks
        this.scanTickingBlocks(args.ticking_blocks);
        // Разошлем мобов всем игрокам, которые "контроллируют" данный чанк
        if(this.connections.size > 0) {
            if(this.mobs.size > 0) {
                this.sendMobs(Array.from(this.connections.keys()));
            }
            if(this.drop_items.size > 0) {
                this.sendDropItems(Array.from(this.connections.keys()));
            }
            if(fluidBuf) {
                this.sendFluid(fluidBuf);
            }
        }
    }

    //
    scanTickingBlocks(ticking_blocks) {
        if(NO_TICK_BLOCKS) {
            return false;
        }
        let block = null;
        const _pos = new Vector(0, 0, 0);
        // 1. Check modified blocks
        const ml = this.modify_list.obj;
        if(ml) {
            for(let index in ml) {
                const current_block_on_pos = ml[index];
                if(!current_block_on_pos) {
                    continue;
                }
                _pos.fromFlatChunkIndex(index);
                // @todo if chest
                if(!block || block.id != current_block_on_pos.id) {
                    block = BLOCK.fromId(current_block_on_pos.id);
                }
                if(block.ticking && current_block_on_pos.extra_data && !('notick' in current_block_on_pos.extra_data)) {
                    this.ticking_blocks.add(_pos.add(this.coord));
                }
            }
        }
        // 2. Check generated blocks
        if(ticking_blocks.length > 0) {
            for(let k of ticking_blocks) {
                _pos.fromHash(k);
                if(!ml || !ml[_pos.getFlatIndexInChunk()]) {
                    const block = this.getBlock(_pos);
                    if(block.material.ticking && block.extra_data && !('notick' in block.extra_data)) {
                        this.ticking_blocks.add(_pos);
                    }
                }
            }
        }
    }

    // Return block key
    getBlockKey(pos) {
        return new Vector(pos).toHash();
    }

    //
    sendAll(packets, except_players) {
        const connections = Array.from(this.connections.keys());
        this.world.sendSelected(packets, connections, except_players);
    }

    getChunkManager() {
        return this.world.chunks;
    }

    // Get the type of the block at the specified position.
    // Mostly for neatness, since accessing the array
    // directly is easier and faster.
    getBlock(pos, y, z) {
        if(this.load_state != CHUNK_STATE_BLOCKS_GENERATED) {
            return this.getChunkManager().DUMMY;
        }

        if (typeof pos == 'number') {
            pos = new Vector(pos, y, z).flooredSelf().subSelf(this.coord);
        } else if (typeof pos == 'Vector') {
            pos = pos.floored().subSelf(this.coord);
        } else if (typeof pos == 'object') {
            pos = new Vector(pos).flooredSelf().subSelf(this.coord);
        }

        if(pos.x < 0 || pos.y < 0 || pos.z < 0 || pos.x >= this.size.x || pos.y >= this.size.y || pos.z >= this.size.z) {
            return this.getChunkManager().DUMMY;
        }
        const block = this.tblocks.get(pos);
        return block;
    }

    // getBlockAsItem
    getBlockAsItem(pos, y, z) {
        const block = this.getBlock(pos, y, z);
        return BLOCK.convertItemToDBItem(block);
    }

    // onBlockSet
    async onBlockSet(item_pos, item) {
        switch(item.id) {
            // 1. Make snow golem
            case BLOCK.LIT_PUMPKIN.id: {
                const pos = item_pos.clone();
                pos.y--;
                let under1 = this.world.getBlock(pos.clone());
                pos.y--;
                let under2 = this.world.getBlock(pos.clone());
                if(under1?.id == BLOCK.POWDER_SNOW.id && under2?.id == BLOCK.POWDER_SNOW.id) {
                    pos.addSelf(new Vector(.5, 0, .5));
                    const params = {
                        type           : 'snow_golem',
                        skin           : 'base',
                        pos            : pos.clone(),
                        pos_spawn      : pos.clone(),
                        rotate         : item.rotate ? new Vector(item.rotate).toAngles() : null
                    }
                    await this.world.mobs.create(params);
                    const actions = new WorldAction(null, this.world, false, false);
                    actions.addBlocks([
                        {pos: item_pos, item: BLOCK.AIR},
                        {pos: under1.posworld, item: BLOCK.AIR},
                        {pos: under2.posworld, item: BLOCK.AIR}
                    ])
                    this.world.actions_queue.add(null, actions);
                }
                break;
            }
        }
    }

    // Store in modify list
    addModifiedBlock(pos, item) {
        const ml = this.modify_list;
        if(!ml.obj) ml.obj = {};
        ml.obj[pos.getFlatIndexInChunk()] = item;
        ml.compressed = null;
        if(item && item.id) {
            const block = BLOCK.fromId(item.id);
            if(block.ticking && item.extra_data && !('notick' in item.extra_data)) {
                this.ticking_blocks.add(pos);
            }
        }
    }

    // On world tick
    tick(tick_number) {
        this.ticking_blocks.tick(tick_number);
    }

    // Before unload chunk
    async onUnload() {
        const chunkManager = this.getChunkManager();
        if (!chunkManager) {
            return;
        }
        chunkManager.dataWorld.removeChunk(this);
        this.setState(CHUNK_STATE_UNLOADED);
        // Unload mobs
        if(this.mobs.size > 0) {
            for(let [entity_id, mob] of this.mobs) {
                await mob.onUnload();
            }
        }
        // Unload drop items
        if(this.drop_items.size > 0) {
            for(let [entity_id, drop_item] of this.drop_items) {
                drop_item.onUnload();
            }
        }
        // Need unload in worker
        this.world.chunks.chunkUnloaded(this.addr);
    }

}