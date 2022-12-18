import { CHUNK_SIZE, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../www/js/chunk_const.js";
import { ServerClient } from "../www/js/server_client.js";
import { DIRECTION, SIX_VECS, Vector, VectorCollector } from "../www/js/helpers.js";
import { BLOCK } from "../www/js/blocks.js";
import { ChestHelpers, RIGHT_NEIGBOUR_BY_DIRECTION } from "../www/js/block_helpers.js";
import { newTypedBlocks, TBlock } from "../www/js/typed_blocks3.js";
import { WorldAction } from "../www/js/world_action.js";
import { COVER_STYLE_SIDES, NO_TICK_BLOCKS } from "../www/js/constant.js";
import { compressWorldModifyChunk, decompressWorldModifyChunk } from "../www/js/compress/world_modify_chunk.js";
import { FLUID_STRIDE, FLUID_TYPE_MASK, FLUID_LAVA_ID, OFFSET_FLUID } from "../www/js/fluid/FluidConst.js";
import { DelayedCalls } from "./server_helpers.js";
import { MobGenerator } from "./mob/generator.js";
import { TickerHelpers } from "./ticker/ticker_helpers.js";

export const CHUNK_STATE_NEW               = 0;
export const CHUNK_STATE_LOADING           = 1;
export const CHUNK_STATE_LOADED            = 2;
export const CHUNK_STATE_BLOCKS_GENERATED  = 3;
export const CHUNK_STATE_UNLOADED          = 4;

const _rnd_check_pos = new Vector(0, 0, 0);

// Ticking block
class TickingBlock {

    #chunk;

    constructor(chunk) {
        this.#chunk     = chunk;
        this.pos        = new Vector(0, 0, 0);
        // this.tblock     = null;
        this.ticking    = null;
        this.ticker     = null;
        this._preloadFluidBuf   = null;
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
            TickerHelpers.pushBlockUpdates(updated_blocks, upd_blocks);
        }
        world.addUpdatedBlocksActions(updated_blocks);
    }

}

let global_uniqId = 0;

// Server chunk
export class ServerChunk {

    constructor(world, addr) {
        this.world          = world;
        this.size           = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        this.addr           = new Vector(addr);
        this.coord          = this.addr.mul(this.size);
        this.uniqId         = ++global_uniqId;
        this.connections    = new Map();
        this.preq           = new Map();
        this.modify_list    = {};
        this.mobs           = new Map();
        this.drop_items     = new Map();
        this.tblocks        = null;
        this.ticking_blocks = new TickingBlockManager(this);
        this.randomTickingBlockCount = 0;
        this.block_random_tickers = this.getChunkManager().block_random_tickers;
        this.options        = {};
        if(['biome2'].indexOf(world.info.generator.id) >= 0) {
            this.mobGenerator   = new MobGenerator(this);
        }
        //if(['npc'].indexOf(world.info.generator.id) >= 0) {
        //    this.mobGenerator = new MobGenerator(this);
        //}
        this.setState(CHUNK_STATE_NEW);
        this.dataChunk      = null;
        this.fluid          = null;
        this.delayedCalls   = new DelayedCalls(world.blockCallees);
        this.blocksUpdatedByDelayedCalls = [];
    }

    get addrHash() { // maybe replace it with a computed string, if it's used often
        return this.addr.toHash();
    }

    get maxBlockX() {
        return this.coord.x + (CHUNK_SIZE_X - 1);
    }
    
    get maxBlockY() {
        return this.coord.y + (CHUNK_SIZE_Y - 1);
    }
    
    get maxBlockZ() {
        return this.coord.z + (CHUNK_SIZE_Z - 1);
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
                        uniqId:         this.uniqId,
                        modify_list:    ml
                    }
                ]
            ]);
            // Разошлем чанк игрокам, которые его запрашивали
            this._preloadFluidBuf = fluid;
            if(this.preq.size > 0) {
                this.sendToPlayers(Array.from(this.preq.keys()));
                this.preq.clear();
            }
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
        drop_item.setPrevChunkAddr(this.addr);
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

        const fluidBuf = this.fluid ? this.fluid.saveDbBuffer() : this._preloadFluidBuf;
        const data = {addr: this.addr,
            modify_list: {},
            // TODO: proper compression for fluid
            fluid: fluidBuf ? Buffer.from(fluidBuf).toString('base64') : null
        };
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
    
    sendFluidDelta(buf) {
        const packets = [{
            name: ServerClient.CMD_FLUID_DELTA,
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
        if (args.uniqId !== this.uniqId) {
            //TODO cover it with a test
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
        if(this._preloadFluidBuf) {
            // now its stored in fluid facet
            this.fluid.loadDbBuffer(this._preloadFluidBuf, true);
            this._preloadFluidBuf = null;
        }
        chunkManager.dataWorld.syncOuter(this);
        //
        this.testing = 1;
        this.randomTickingBlockCount = 0;
        for(let i = 0; i < this.tblocks.id.length; i++) {
            const block_id = this.tblocks.id[i];
            if(BLOCK.isRandomTickingBlock(block_id)) {
                this.randomTickingBlockCount++;
            }
        }
        // load various data in parallel
        const mobPrpmise = this.world.db.mobs.loadInChunk(this.addr, this.size);
        const drop_itemsPromise = this.world.db.loadDropItems(this.addr, this.size);
        const serializedDelayedCalls = await this.world.db.loadAndDeleteChunkDelayedCalls(this);
        if (serializedDelayedCalls) {
            this.delayedCalls.deserialize(serializedDelayedCalls);
        }
        this.mobs = await mobPrpmise;
        this.drop_items = await drop_itemsPromise; 
        // fluid
        if(this.load_state === CHUNK_STATE_UNLOADED) {
            return;
        }
        this.fluid.queue.init();
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
        }
        // If some delayed calls have been loaded
        if (this.delayedCalls.length) {
            chunkManager.chunks_with_delayed_calls.add(this);
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

    // It's slightly faster than getBlock().
    getMaterial(pos, y, z, fromOtherChunks = false) {
        if(this.load_state != CHUNK_STATE_BLOCKS_GENERATED) {
            return this.getChunkManager().DUMMY.material;
        }

        if (typeof pos == 'number') {
            pos = tmp_posVector.set(pos, y, z);
        } else {
            // We expect (typeof pos == 'object') here.
            pos = tmp_posVector.initFrom(pos);
            fromOtherChunks = y;
        }
        pos.flooredSelf().subSelf(this.coord);

        if (pos.x < 0 || pos.y < 0 || pos.z < 0 || pos.x >= this.size.x || pos.y >= this.size.y || pos.z >= this.size.z) {
            if (fromOtherChunks) {
                pos.addSelf(this.coord);
                const otherChunk = this.world.chunks.getReadyByPos(pos);
                if (otherChunk) {
                    // this recursion it doesn't affect tmp_posVector
                    return otherChunk.getMaterial(pos);
                }
            }
            return this.getChunkManager().DUMMY.material;
        }
        return this.tblocks.getMaterial(pos);
    }

    // Get the type of the block at the specified position.
    // Mostly for neatness, since accessing the array
    // directly is easier and faster.
    // If the argument after the coordiantes (y or fromOtherChunks) is true,
    // it can return blocks from chunks outside its boundary.
    getBlock(pos, y, z, resultBlock = null, fromOtherChunks = false) {
        if(this.load_state != CHUNK_STATE_BLOCKS_GENERATED) {
            return this.getChunkManager().DUMMY;
        }

        if (typeof pos == 'number') {
            pos = tmp_posVector.set(pos, y, z);
        } else {
            // We expect (typeof pos == 'object') here.
            pos = tmp_posVector.initFrom(pos);
            resultBlock = y;
            fromOtherChunks = z;
        }
        pos.flooredSelf().subSelf(this.coord);

        if(pos.x < 0 || pos.y < 0 || pos.z < 0 || pos.x >= this.size.x || pos.y >= this.size.y || pos.z >= this.size.z) {
            if (fromOtherChunks) {
                pos.addSelf(this.coord);
                const otherChunk = this.world.chunks.getReadyByPos(pos);
                if (otherChunk) {
                    // this recursion it doesn't affect tmp_posVector
                    return otherChunk.getBlock(pos, resultBlock);
                }
            }
            return this.getChunkManager().DUMMY;
        }
        return this.tblocks.get(pos.clone(), resultBlock);
    }

    // getBlockAsItem
    getBlockAsItem(pos, y, z) {
        const block = this.getBlock(pos, y, z);
        return BLOCK.convertItemToDBItem(block);
    }

    getFluidValue(pos, y, z) {
        if (typeof pos == 'object') {
            y = pos.y;
            z = pos.z;
            pos = pos.x;
        }
        return this.fluid.uint8View[FLUID_STRIDE * this.dataChunk.indexByWorld(pos, y, z) + OFFSET_FLUID];
    }

    isLava(pos, y, z) {
        return (this.getFluidValue(pos, y, z) & FLUID_TYPE_MASK) === FLUID_LAVA_ID;
    }

    isWater(pos, y, z) {
        return (this.getFluidValue(pos, y, z) & FLUID_TYPE_MASK) === FLUID_WATER_ID;
    }

    isFluid(pos, y, z) {
        return (this.getFluidValue(pos, y, z) & FLUID_TYPE_MASK) !== 0;
    }

    // onBlockSet
    async onBlockSet(item_pos, item) {

        const tblock = this.world.getBlock(item_pos);
        if(tblock) {
            const cache = Array.from({length: 6}, _ => new TBlock(null, new Vector(0,0,0)));
            const neighbours = tblock.getNeighbours(this.world, cache);
            for(let side in neighbours) {
                const nb = neighbours[side];
                if(nb.id > 0) {
                    this.onNeighbourChanged(nb, tblock);
                }
            }
        }

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

    //
    onNeighbourChanged(tblock, neighbour) {

        const world = this.world;
        
        //
        function createDrop(tblock) {
            const pos = tblock.posworld;
            const actions = new WorldAction(null, world, false, true);
            actions.addBlocks([
                {pos: pos.clone(), item: BLOCK.AIR}
            ]);
            if (!tblock.material.tags.includes('no_drop')) {
                actions.addDropItem({ pos: pos.clone().addScalarSelf(.5, .5, .5), items: [{ id: tblock.id, count: 1 }], force: true });
            }
            world.actions_queue.add(null, actions);
        }

        const pos = tblock.posworld;
        const rot = tblock.rotate;
        const rotx = tblock.rotate?.x;
        const roty = tblock.rotate?.y;
        const neighbourPos = neighbour.posworld;

        //
        if(neighbour.id == 0) {
            
            if (tblock.id == BLOCK.SNOW.id && neighbourPos.y < pos.y) {
                return createDrop(tblock);
            }

            const require_support = tblock.material.support_style || tblock.material.style;

            switch(require_support) {
                case 'bottom': // not a block style, but a name for a common type of support
                case 'rails':
                case 'candle':
                case 'redstone':
                case 'cactus': {
                    // only bottom
                    if(neighbourPos.y < pos.y) {
                        return createDrop(tblock);
                    }
                    break;
                }
                case 'lantern': {
                    // top and bottom
                    if(neighbourPos.y < pos.y && roty == 1) {
                        return createDrop(tblock);
                    } else if(neighbourPos.y > pos.y && roty == -1) {
                        return createDrop(tblock);
                    }
                    break;
                }
                case 'sign':
                case 'torch': {
                    // nesw + bottom
                    let drop = false;
                    if(rotx == 0 && neighbourPos.z < pos.z) {
                        drop = true;
                    } else if(rotx == 1 && neighbourPos.x > pos.x) {
                        drop = true;
                    } else if(rotx == 2 && neighbourPos.z > pos.z) {
                        drop = true;
                    } else if(rotx == 3 && neighbourPos.x < pos.x) {
                        drop = true;
                    } else if(neighbourPos.y < pos.y && roty == 1) {
                        drop = true;
                    }
                    if(drop) {
                        return createDrop(tblock);
                    }
                    break;
                }
                case 'item_frame': {
                    // 6 sides
                    let drop = false;
                    console.log(neighbourPos.z > pos.z, SIX_VECS.north, rot);
                    if(neighbourPos.z > pos.z && SIX_VECS.south.equal(rot)) {
                        drop = true;
                    } else if(neighbourPos.z < pos.z && SIX_VECS.north.equal(rot)) {
                        drop = true;
                    } else if(neighbourPos.x > pos.x && SIX_VECS.west.equal(rot)) {
                        drop = true;
                    } else if(neighbourPos.x < pos.x && SIX_VECS.east.equal(rot)) {
                        drop = true;
                    } else if(neighbourPos.y > pos.y && rot.y == -1) {
                        drop = true;
                    } else if(neighbourPos.y < pos.y && rot.y == 1) {
                        drop = true;
                    }
                    if(drop) {
                        return createDrop(tblock);
                    }
                    break;
                }
                case 'chest': {
                    // if a chest half is missing the other half, convert it to a normal chest
                    if (neighbourPos.y === pos.y && // a fast redundant check to eliminate 2 out of 6 slower checks
                        ChestHelpers.getSecondHalfPos(tblock)?.equal(neighbourPos)
                    ) {
                        const newTblock = tblock.clonePOJO();
                        delete newTblock.extra_data.type;
                        const actions = new WorldAction();
                        actions.addBlocks([
                            {
                                pos: pos.clone(),
                                item: newTblock,
                                action_id: ServerClient.BLOCK_ACTION_MODIFY
                            }
                        ]);
                        world.actions_queue.add(null, actions);
                    }
                    break;
                }
                case 'painting':
                case 'ladder': {
                    if (neighbourPos.y === pos.y) {
                        // 6 sides
                        let drop = false;
                        if(neighbourPos.z > pos.z && (rot.x == DIRECTION.SOUTH || SIX_VECS.south.equal(rot))) {
                            drop = true;
                        } else if(neighbourPos.z < pos.z && (rot.x == DIRECTION.NORTH || SIX_VECS.north.equal(rot))) {
                            drop = true;
                        } else if(neighbourPos.x > pos.x && (rot.x == DIRECTION.WEST || SIX_VECS.west.equal(rot))) {
                            drop = true;
                        } else if(neighbourPos.x < pos.x && (rot.x == DIRECTION.EAST || SIX_VECS.east.equal(rot))) {
                            drop = true;
                        }
                        if(drop) {
                            return createDrop(tblock);
                        }
                    }
                    break;
                }
                case 'cover': {
                    let drop = false;
                    if(tblock.extra_data) {
                        const removeCoverSide = (side_name) => {
                            if(tblock.extra_data[side_name]) {
                                const new_extra_data = {...tblock.extra_data}
                                delete(new_extra_data[side_name])
                                const existing_faces = Object.keys(new_extra_data).filter(value => COVER_STYLE_SIDES.includes(value));
                                if(existing_faces.length == 0) {
                                    drop = true;
                                } else {
                                    const newTblock = tblock.clonePOJO();
                                    newTblock.extra_data = new_extra_data;
                                    const actions = new WorldAction();
                                    actions.addBlocks([
                                        {
                                            pos: pos.clone(),
                                            item: newTblock,
                                            action_id: ServerClient.BLOCK_ACTION_MODIFY
                                        }
                                    ]);
                                    world.actions_queue.add(null, actions);
                                }
                            }
                        }
                        //
                        if(neighbourPos.z > pos.z) {
                            removeCoverSide('south')
                        } else if(neighbourPos.z < pos.z) {
                            removeCoverSide('north')
                        } else if(neighbourPos.x > pos.x) {
                            removeCoverSide('west')
                        } else if(neighbourPos.x < pos.x) {
                            removeCoverSide('east')
                        } else if(neighbourPos.y < pos.y) {
                            removeCoverSide('up')
                        } else if(neighbourPos.y > pos.y) {
                            removeCoverSide('down')
                        }
                    } else {
                        drop = true;
                    }
                    //
                    if(drop) {
                        return createDrop(tblock);
                    }
                    break;
                }
            }
        } else {
            switch(tblock.material.style) {
                case 'cactus': {
                    // nesw only
                    if(neighbourPos.y == pos.y && !(neighbour.material.transparent && neighbour.material.light_power)) {
                        return createDrop(tblock);
                    }
                    break;
                }
                case 'chest': {
                    const chestId = BLOCK.CHEST.id;
                    // check if we can combine two halves into a double chest
                    if (neighbourPos.y !== pos.y ||
                        tblock.material.id !== chestId ||
                        tblock.extra_data?.type ||
                        neighbour.material.id !== chestId ||
                        neighbour.extra_data?.type
                    ) {
                        break;
                    }
                    const dir = BLOCK.getCardinalDirection(rot);
                    if (dir !== BLOCK.getCardinalDirection(neighbour.rotate)) {
                        break;
                    }
                    var newType = null;
                    var newNeighbourType = null;
                    const dxz = RIGHT_NEIGBOUR_BY_DIRECTION[dir];
                    const expectedNeighbourPos = pos.clone().addSelf(dxz);
                    if (expectedNeighbourPos.equal(neighbourPos)) {
                        newType = 'right';
                        newNeighbourType = 'left';
                        // a fix for a chest inserted btween two - the one on the left doesn't attempt to transform
                        const farNeighbourPos = expectedNeighbourPos.clone().addSelf(dxz);
                        var farNeighbour = this.getBlock(farNeighbourPos, null, true);
                        if (farNeighbour &&
                            farNeighbour.material.id === chestId &&
                            farNeighbour.extra_data?.type == null &&
                            dir === BLOCK.getCardinalDirection(farNeighbour.rotate)
                        ) {
                            break;
                        }
                    } else {
                        expectedNeighbourPos.copyFrom(pos).subSelf(dxz);
                        if (expectedNeighbourPos.equal(neighbourPos)) {
                            newType = 'left';
                            newNeighbourType = 'right';
                        } else {
                            break;
                        }
                    }
                    const newTblock                 = tblock.clonePOJO();
                    newTblock.extra_data            = newTblock.extra_data || {};
                    newTblock.extra_data.type       = newType;
                    const newNeighbour              = neighbour.clonePOJO();
                    newNeighbour.extra_data         = newNeighbour.extra_data || {};
                    newNeighbour.extra_data.type    = newNeighbourType;
                    const actions = new WorldAction();
                    actions.addBlocks([
                        {
                            pos: pos.clone(),
                            item: newTblock,
                            action_id: ServerClient.BLOCK_ACTION_MODIFY
                        },
                        {
                            pos: neighbourPos.clone(),
                            item: newNeighbour,
                            action_id: ServerClient.BLOCK_ACTION_MODIFY
                        }
                    ]);
                    world.actions_queue.add(null, actions);
                    break;
                }
            }
        }

        return false;

    }

    // Store in modify list
    addModifiedBlock(pos, item) {
        const ml = this.modify_list;
        if(!ml.obj) ml.obj = {};
        ml.obj[pos.getFlatIndexInChunk()] = item;
        ml.compressed = null;
        if(item) {
            // calculate random ticked blocks
            if(this.getBlock(pos)?.material?.random_ticker) {
                this.randomTickingBlockCount--;
            }
            //
            if(item.id) {
                const block = BLOCK.fromId(item.id);
                if(block.random_ticker) {
                    this.randomTickingBlockCount++;
                }
                if(block.ticking && item.extra_data && !('notick' in item.extra_data)) {
                    this.ticking_blocks.add(pos);
                }
            }
        }
    }

    // On world tick
    tick(tick_number) {
        this.ticking_blocks.tick(tick_number);
    }

    getActions() {
        if(!this._random_tick_actions) {
            this._random_tick_actions = new WorldAction(null, this.world, false, false);
        }
        return this._random_tick_actions;
    }

    // Random tick
    randomTick(tick_number, world_light, check_count) {

        if(this.load_state != CHUNK_STATE_BLOCKS_GENERATED || !this.tblocks || this.randomTickingBlockCount <= 0) {
            return false;
        }

        let tblock;

        for (let i = 0; i < check_count; i++) {
            _rnd_check_pos.fromFlatChunkIndex(Math.floor(Math.random() * CHUNK_SIZE));
            const block_id = this.tblocks.getBlockId(_rnd_check_pos.x, _rnd_check_pos.y, _rnd_check_pos.z);
            if(block_id > 0) {
                const ticker = this.block_random_tickers.get(block_id);
                if(ticker) {
                    tblock = this.tblocks.get(_rnd_check_pos, tblock);
                    ticker.call(this, this.world, this.getActions(), world_light, tblock);
                }
            }
        }

        //
        const actions = this._random_tick_actions;
        if(actions && actions.blocks.list.length > 0) {
            globalThis.modByRandomTickingBlocks = (globalThis.modByRandomTickingBlocks | 0) + actions.blocks.list.length;
            this.world.actions_queue.add(null, actions);
            this._random_tick_actions = null;
        }

        return true;

    }

    addDelayedCall(calleeId, delay, args) {
        this.delayedCalls.add(calleeId, delay, args);
        // If we just aded the 1st call, we know the chunk is not in the set
        if (this.delayedCalls.length === 1) {
            this.getChunkManager().chunks_with_delayed_calls.add(this);
        }
    }

    executeDelayedCalls() {
        if (this.delayedCalls.length === 0) {
            return;
        }
        this.delayedCalls.execute(this);
        // If we just emptied the calls list, delete the chunk from the set
        if (this.delayedCalls.length === 0) {
            this.getChunkManager().chunks_with_delayed_calls.delete(this);
        }
        this.world.addUpdatedBlocksActions(this.blocksUpdatedByDelayedCalls);
        this.blocksUpdatedByDelayedCalls.length = 0;
    }

    // Before unload chunk
    async onUnload() {
        const chunkManager = this.getChunkManager();
        if (!chunkManager) {
            return;
        }
        this.setState(CHUNK_STATE_UNLOADED);
        if (this.delayedCalls.length) {
            chunkManager.chunks_with_delayed_calls.delete(this);
        }
        if (this.dataChunk) {
            await this.world.db.fluid.flushChunk(this);
            chunkManager.dataWorld.removeChunk(this);
        }

        const promises = [];
        // Unload mobs
        if(this.mobs.size > 0) {
            for(let [entity_id, mob] of this.mobs) {
                promises.push(mob.onUnload());
            }
        }
        // Unload drop items
        if(this.drop_items.size > 0) {
            for(let [entity_id, drop_item] of this.drop_items) {
                promises.push(drop_item.onUnload());
            }
        }
        if (this.delayedCalls.length) {
            promises.push(this.world.db.saveChunkDelayedCalls(this));
        }
        await Promise.all(promises);
        // Need unload in worker
        this.world.chunks.chunkUnloaded(this.addr);
    }

}

const tmp_posVector         = new Vector();