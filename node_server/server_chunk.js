import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../www/js/chunk.js";
import {ServerClient} from "../www/js/server_client.js";
import {Vector, VectorCollector} from "../www/js/helpers.js";
import {BLOCK} from "../www/js/blocks.js";
import {TypedBlocks, TBlock} from "../www/js/typed_blocks.js";
import {impl as alea} from '../www/vendors/alea.js';

const Tickers = new Map();
for(let fn of ['bamboo', 'charging_station', 'dirt', 'sapling', 'spawnmob', 'stage', 'furnace']) {
    await import(`./ticker/${fn}.js`).then((module) => {
        Tickers.set(module.default.type, module.default.func);
    });
}

export const CHUNK_STATE_NEW               = 0;
export const CHUNK_STATE_LOADING           = 1;
export const CHUNK_STATE_LOADED            = 2;
export const CHUNK_STATE_BLOCKS_GENERATED  = 3;
//
export const STAGE_TIME_MUL                = 5; // 20;

// Ticking block
class TickingBlock {

    #manager;

    constructor(manager, id, pos, ticking) {
        this.id         = id;
        this.pos        = pos.clone();
        this.ticking    = ticking;
        this.#manager   = manager;
        this.ticks      = 0;
    }

    get tblock() {
        return this.#manager.chunk.getBlock(this.pos);
    }

}

// TickingBlockManager
class TickingBlockManager {

    #chunk;

    constructor(chunk) {
        this.#chunk = chunk;
        this.blocks = new Map();
    }

    get chunk() {
        return this.#chunk;
    }

    // addTickingBlock
    add(id, pos, ticking) {
        const block = new TickingBlock(this, id, pos, ticking);
        const ex_block = this.blocks.get(block.pos.toHash());
        if(ex_block) {
            block.ticks = ex_block.ticks;
        }
        this.blocks.set(block.pos.toHash(), block);
        this.#chunk.world.chunks.addTickingChunk(this.#chunk.addr);
    }

    // deleteTickingBlock
    delete(pos) {
        const k = pos.toHash();
        this.blocks.delete(k);
        if(this.blocks.size == 0) {
            this.#chunk.world.chunks.removeTickingChunk(this.#chunk.addr);
        }
    }

    // tick
    async tick() {
        const world             = this.#chunk.world;
        const updated_blocks    = [];
        const ignore_coords     = new VectorCollector();
        const check_pos         = new Vector(0, 0, 0);
        //
        for(let [k, v] of this.blocks.entries()) {
            const tblock = v.tblock;
            const ticking = v.ticking;
            let extra_data = tblock.extra_data;
            const current_block = this.chunk.getBlock(v.pos);
            if(!extra_data || !current_block || current_block.id != tblock.id) {
                this.delete(v.pos);
                continue;
            }
            if(Math.random() > .33) {
                v.ticks++;
                const ticker = Tickers.get(ticking.type);
                if(ticker) {
                    const upd_blocks = await ticker.call(this, world, this.#chunk, v, check_pos, ignore_coords);
                    if(Array.isArray(upd_blocks)) {
                        updated_blocks.push(...upd_blocks);
                    }
                } else {
                    console.log(`Invalid ticking type: ${ticking.type}`);
                }
            }
        }
        if(updated_blocks.length > 0) {
            const actions = {blocks: {list: updated_blocks}};
            await world.applyActions(null, actions);
        }
    }

}

// Mob generator
class MobGenerator {

    constructor(chunk) {
        this.chunk = chunk;
        this.types = [];
        this.types.push({type: 'chicken', skin: 'base', count: 4});
        this.types.push({type: 'chicken', skin: 'base', count: 4});
        this.types.push({type: 'sheep', skin: 'base', count: 4});
        this.types.push({type: 'cow', skin: 'base', count: 4});
        this.types.push({type: 'horse', skin: 'creamy', count: 2});
        this.types.push({type: 'pig', skin: 'base', count: 4});
        this.types.push({type: 'fox', skin: 'base', count: 1});
    }

    async generate() {
        // Auto generate mobs
        const auto_generate_mobs = this.chunk.world.getGeneratorOptions('auto_generate_mobs', true);
        if(auto_generate_mobs) {
            // probability 1/10
            const chunk_addr_hash = this.chunk.addr.toHash();
            this.random = new alea('chunk' + chunk_addr_hash);
            this.can_generate = this.random.double() < .05;
            if(!this.can_generate) {
                return false;
            }
            // if generating early
            if(await this.chunk.world.chunks.chunkMobsIsGenerated(chunk_addr_hash)) {
                return false;
            }
            // check chunk is good place for mobs
            if(this.chunk.tblocks) {
                let material = null;
                let pos2d = new Vector(0, 0, 0);
                const blockIter = this.chunk.tblocks.createUnsafeIterator(new TBlock(null, new Vector(0, 0, 0)));
                let vc = new VectorCollector();
                // Обход всех блоков данного чанка
                for(let block of blockIter) {
                    material = block.material;
                    if(material && material.id == BLOCK.GRASS_DIRT.id) {
                        pos2d.x = block.vec.x;
                        pos2d.z = block.vec.z;
                        vc.set(pos2d, block.vec.y);
                    }
                }
                //
                if(vc.size > CHUNK_SIZE_X * CHUNK_SIZE_Z / 2) {
                    let cnt = 0;
                    let poses = [];
                    const pos_up = new Vector(0, 0, 0);
                    for(let [vec, y] of vc.entries()) {
                        if(cnt++ % 2 == 0) {
                            pos_up.copyFrom(vec);
                            pos_up.y = y;
                            //
                            pos_up.y++;
                            let up1 = this.chunk.tblocks.get(pos_up);
                            let up1_id = up1.id;
                            pos_up.y++;
                            let up2 = this.chunk.tblocks.get(pos_up);
                            let up2_id = up2.id;
                            //
                            if((up1_id == 0 || up1_id == 31) && (up2_id == 0 || up2_id == 31)) {
                                const pos = new Vector(.5, y + 1, .5);
                                pos.addSelf(vec).addSelf(this.chunk.coord);
                                poses.push(pos);
                            }
                        }
                    }
                    if(poses.length > 0) {
                        poses.sort(() => .5 - Math.random());
                        const index = Math.floor(this.random.double() * this.types.length);
                        const t = this.types[index];
                        if(poses.length >= t.count) {
                            for(let i = 0; i < t.count; i++) {
                                const params = {
                                    pos: poses.shift(),
                                    rotate: new Vector(0, 0, this.random.double() * Math.PI * 2),
                                    ...t
                                };
                                // Spawn mob
                                await this.chunk.world.createMob(params);
                            }
                        }
                    }
                }
            }
            // mark as generated
            await this.chunk.world.chunks.chunkSetMobsIsGenerated(chunk_addr_hash, 1);
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
        this.modify_list    = new Map();
        this.mobs           = new Map();
        this.drop_items     = new Map();
        this.ticking_blocks = new TickingBlockManager(this);
        this.options        = {STAGE_TIME_MUL};
        if(['biome2'].indexOf(world.info.generator.id) >= 0) {
            this.mobGenerator   = new MobGenerator(this);
        }
        this.setState(CHUNK_STATE_NEW);
    }

    // Set chunk init state
    setState(state_id) {
        this.load_state = state_id;
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
    async load() {
        if(this.load_state > CHUNK_STATE_NEW) {
            return;
        }
        this.setState(CHUNK_STATE_LOADING);
        if(this.world.chunkHasModifiers(this.addr)) {
            this.modify_list = await this.world.db.loadChunkModifiers(this.addr, this.size);
            this.ticking = new Map();
        }
        this.setState(CHUNK_STATE_LOADED);
        // Send requet to worker for create blocks structure
        this.world.chunks.postWorkerMessage(['createChunk',
            [
                {
                    update:         true,
                    addr:           this.addr,
                    modify_list:    Object.fromEntries(this.modify_list)
                }
            ]
        ]);
        // Разошлем чанк игрокам, которые его запросили
        if(this.preq.size > 0) {
            this.sendToPlayers(Array.from(this.preq.keys()));
            this.preq.clear();
        }
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
                let packets = [{
                    name: ServerClient.CMD_MOB_DELETED,
                    data: Array.from(this.mobs.keys())
                }];
                this.world.sendSelected(packets, [player.session.user_id], []);
            }
            if(this.drop_items.size > 0) {
                let packets = [{
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
        let packets = [{
            name: ServerClient.CMD_MOB_ADDED,
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
        let packets = [{
            name: ServerClient.CMD_CHUNK_LOADED,
            data: {
                addr:        this.addr,
                modify_list: Object.fromEntries(this.modify_list),
            }
        }];
        this.world.sendSelected(packets, player_ids, []);
        return true
    }

    sendMobs(player_user_ids) {
        // Send all mobs in this chunk
        if (this.mobs.size < 1) {
            return;
        }
        let packets_mobs = [{
            name: ServerClient.CMD_MOB_ADDED,
            data: []
        }];
        for(const [_, mob] of this.mobs) {
            packets_mobs[0].data.push(mob);
        }
        this.world.sendSelected(packets_mobs, player_user_ids, []);
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
        this.tblocks = new TypedBlocks(this.coord);
        if(args.tblocks) {
            this.tblocks.restoreState(args.tblocks);
        }
        //
        this.mobs = await this.world.db.loadMobs(this.addr, this.size);
        this.drop_items = await this.world.db.loadDropItems(this.addr, this.size);
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
    }

    //
    scanTickingBlocks(ticking_blocks) {
        let block = null;
        let pos = new Vector(0, 0, 0);
        // 1. Check modified blocks
        for(let k of this.modify_list.keys()) {
            let temp = k.split(',');
            pos.set(temp[0] | 0, temp[1] | 0, temp[2] | 0);
            const current_block_on_pos = this.modify_list.get(k);
            // @todo if chest
            // this.modify_list.set(k, chest.entity.item);
            if(!block || block.id != current_block_on_pos.id) {
                block = BLOCK.fromId(current_block_on_pos.id);
            }
            if(block.ticking && current_block_on_pos.extra_data && !('notick' in current_block_on_pos.extra_data)) {
                this.ticking_blocks.add(block.id, pos, block.ticking);
            }
        }
        // 2. Check generated blocks
        if(ticking_blocks.length > 0) {
            for(let k of ticking_blocks) {
                if(!this.modify_list.has(k)) {
                    let temp = k.split(',');
                    pos.set(temp[0] | 0, temp[1] | 0, temp[2] | 0);
                    let block = this.getBlock(pos);
                    if(block.material.ticking && block.extra_data && !('notick' in block.extra_data)) {
                        this.ticking_blocks.add(block.id, pos, block.material.ticking);
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
            pos = new Vector(pos, y, z);
        } else if (typeof pos == 'Vector') {
            // do nothing
        } else if (typeof pos == 'object') {
            pos = new Vector(pos);
        }

        pos = pos.floored().sub(this.coord);
        if(pos.x < 0 || pos.y < 0 || pos.z < 0 || pos.x >= this.size.x || pos.y >= this.size.y || pos.z >= this.size.z) {
            return this.getChunkManager().DUMMY;
        }
        let block = this.tblocks.get(pos);
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
                let pos = item_pos.clone();
                pos.y--;
                let under1 = this.world.getBlock(pos.clone());
                pos.y--;
                let under2 = this.world.getBlock(pos.clone());
                if(under1?.id == BLOCK.SNOW_BLOCK.id && under2?.id == BLOCK.SNOW_BLOCK.id) {
                    pos.addSelf(new Vector(.5, 0, .5));
                    const params = {
                        type           : 'snow_golem',
                        skin           : 'base',
                        pos            : pos.clone(),
                        pos_spawn      : pos.clone(),
                        rotate         : item.rotate ? new Vector(item.rotate).toAngles() : null
                    }
                    await this.world.createMob(params);
                    await this.world.applyActions(null, {blocks: {list: [
                        {pos: item_pos, item: BLOCK.AIR},
                        {pos: under1.posworld, item: BLOCK.AIR},
                        {pos: under2.posworld, item: BLOCK.AIR}
                    ]}});
                }
                break;
            }
        }
    }

    // Store in modify list
    addModifiedBlock(pos, item) {
        this.modify_list.set(pos.toHash(), item);
        if(item && item.id) {
            let block = BLOCK.fromId(item.id);
            if(block.ticking && item.extra_data && !('notick' in item.extra_data)) {
                this.ticking_blocks.add(block.id, pos, block.ticking);
            }
        }
    }

    // On world tick
    async tick() {
        await this.ticking_blocks.tick();
    }

    // Before unload chunk
    async onUnload() {
        // Unload mobs
        if(this.mobs.size > 0) {
            for(let [entity_id, mob] of this.mobs) {
                mob.onUnload();
            }
        }
        // Unload drop items
        if(this.drop_items.size > 0) {
            for(let [entity_id, drop_item] of this.drop_items) {
                drop_item.onUnload();
            }
        }
        // Need unload in worker
        this.world.chunks.postWorkerMessage(['destructChunk',
            [this.addr]
        ]);
        //
        this.world.chunks.removeTickingChunk(this.addr);
    }

}