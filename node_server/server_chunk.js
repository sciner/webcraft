import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_BLOCKS, getChunkAddr} from "../www/js/chunk.js";
import {ServerClient} from "../www/js/server_client.js";
import {Vector, VectorCollector} from "../www/js/helpers.js";
import {BLOCK} from "../www/js/blocks.js";
import {TypedBlocks} from "../www/js/typed_blocks.js";

export const CHUNK_STATE_NEW               = 0;
export const CHUNK_STATE_LOADING           = 1;
export const CHUNK_STATE_LOADED            = 2;
export const CHUNK_STATE_BLOCKS_GENERATED  = 3;

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
        this.setState(CHUNK_STATE_NEW);
    }

    // Set chunk init state
    setState(state_id) {
        this.load_state = state_id;
    }

    // Load state from DB
    async load() {
        if(this.load_state > CHUNK_STATE_NEW) {
            return;
        }
        this.setState(CHUNK_STATE_LOADING);
        if(this.world.chunkHasModifiers(this.addr)) {
            this.modify_list = await this.world.db.loadChunkModifiers(this.addr, this.size);
        }
        this.setState(CHUNK_STATE_LOADED);
        // Send requet to worker for create blocks structure
        this.world.chunks.postWorkerMessage(['createChunk', {
            size:           this.size,
            coord:          this.coord,
            addr:           this.addr,
            modify_list:    Object.fromEntries(this.modify_list)
        }]);
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
        this.mobs.set(mob.entity_id, mob);
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
        this.tblocks            = new TypedBlocks(this.coord);
        this.tblocks.count      = CHUNK_BLOCKS;
        this.tblocks.buffer     = args.tblocks.buffer;
        this.tblocks.id         = new Uint16Array(this.tblocks.buffer, 0, this.tblocks.count);
        this.tblocks.power      = new VectorCollector(args.tblocks.power.list);
        this.tblocks.rotate     = new VectorCollector(args.tblocks.rotate.list);
        this.tblocks.entity_id  = new VectorCollector(args.tblocks.entity_id.list);
        this.tblocks.texture    = new VectorCollector(args.tblocks.texture.list);
        this.tblocks.extra_data = new VectorCollector(args.tblocks.extra_data.list);
        this.tblocks.vertices   = new VectorCollector(args.tblocks.vertices.list);
        this.tblocks.shapes     = new VectorCollector(args.tblocks.shapes.list);
        this.tblocks.falling    = new VectorCollector(args.tblocks.falling.list);
        //
        this.mobs = await this.world.db.loadMobs(this.addr, this.size);
        this.drop_items = await this.world.db.loadDropItems(this.addr, this.size);
        this.setState(CHUNK_STATE_BLOCKS_GENERATED);
        // Разошлем мобов всем игрокам, которые "контроллируют" данный чанк
        if(this.connections.size > 0 && this.mobs.size > 0) {
            this.sendMobs(Array.from(this.connections.keys()));
        }
        if(this.connections.size > 0 && this.drop_items.size > 0) {
            this.sendDropItems(Array.from(this.connections.keys()));
        }
    }

    // Return block key
    getBlockKey(pos) {
        return new Vector(pos).toHash();
    }

    // 
    async blockAction(player, params, notify_author) {
        // Check action
        switch(params.action_id) {
            case ServerClient.BLOCK_ACTION_DESTROY: {
                // 1. Drop block if need
                if(player.game_mode.isSurvival()) {
                    const item = this.getBlockAsItem(params.pos);
                    let mat = BLOCK.fromId(item.id);
                    if(mat.spawnable && mat.tags.indexOf('no_drop') < 0) {
                        item.count = 1;
                        this.world.createDropItems(player, new Vector(params.pos).add(new Vector(.5, 0, .5)), [item]);
                    }
                }
                // Destroyed block
                const pos = new Vector(params.pos);
                let block = this.world.getBlock(pos);
                //
                let items = [];
                items.push(...await this.blockSet(player, params, notify_author, true));
                //
                const blocks_for_destroy = [block];
                //
                // 2. destroy plants over this block
                let block_under = this.world.getBlock(pos.add(Vector.YP));
                if(BLOCK.isPlants(block_under.id)) {
                    blocks_for_destroy.push(block_under);
                    items.push({pos: block_under.posworld, item: {id: BLOCK.AIR.id}});
                }
                // 3. Destroy connected blocks
                for(let bfd of blocks_for_destroy) {
                    for(let cn of ['next_part', 'previous_part']) {
                        let part = bfd.material[cn];
                        if(part) {
                            let connected_pos = bfd.posworld.add(part.offset_pos);
                            let block_connected = this.world.getBlock(connected_pos);
                            if(block_connected.id == part.id) {
                                items.push({pos: connected_pos, item: {id: BLOCK.AIR.id}});
                            }
                        }
                    }
                }
                await this.world.setBlocksApply(items);
                break;
            }
            default: {
                return await this.blockSet(player, params, notify_author);
                break;
            }
        }
    }

    // Set block
    async blockSet(player, params, notify_author, return_items = false) {
        let is_creative = player.game_mode.isCreative();
        // 1. Detect build material
        let material = player.inventory.current_item;
        //
        switch(params.action_id) {
            case ServerClient.BLOCK_ACTION_DESTROY: {
                // Принудительно ставим материалом воздух
                material = BLOCK.AIR;
                params.item = {id: material.id};
                break;
            }
            case ServerClient.BLOCK_ACTION_MODIFY: {
                if(!('extra_data' in params.item)) {
                    throw 'error_empty_extra_data';
                }
                const existing_block = this.getBlock(params.pos);
                if(existing_block.id != params.item.id) {
                    throw 'error_materials_not_equal';
                }
                if('entity_id' in params.item) {
                    if(params.item.entity_id != existing_block.entity_id) {
                        throw 'error_invalid_entity_id';
                    }
                }
                material = params.item;
                break;
            }
        }
        //
        if(!material) {
            if(is_creative) {
                material = BLOCK.fromId(params.item.id);
            } else {
                throw 'error_material_not_selected';
            }
        } else {
            material = BLOCK.fromId(material.id);
        }
        if(material.deprecated) {
            throw 'error_deprecated_block';
        }
        let new_item = {
            id: material.id
        };
        //
        let pos = new Vector(params.pos).floored();
        // Check position if occupied and not can be replaced
        switch(params.action_id) {
            case ServerClient.BLOCK_ACTION_REPLACE:
            case ServerClient.BLOCK_ACTION_CREATE: {
                let check_poses = [pos];
                if(material.next_part) {
                    // Если этот блок имеет "пару"
                    check_poses.push(pos.add(material.next_part.offset_pos));
                }
                for(let cp of check_poses) {
                    let cp_block = this.world.getBlock(cp);
                    if(!BLOCK.canReplace(cp_block.id, cp_block.extra_data, material.id)) {
                        throw 'error_block_cannot_be_replace';
                    }
                }
                break;
            }
        }
        //
        if(params.item) {
            for(const prop of ['entity_id', 'extra_data', 'power', 'rotate']) {
                if(prop in params.item) {
                    new_item[prop] = params.item[prop];
                }
            }
        }
        // 2.
        if(!this.connections.has(player.session.user_id)) {
            this.addPlayer(player);
        }
        // 3. If is egg
        if(BLOCK.isEgg(material.id)) {
            // @ParamChatSendMessage
            let chat_message = {
                username: player.session.username,
                text:     "/spawnmob " + (params.pos.x + ".5 ") + params.pos.y + " " + (params.pos.z + ".5 ") + material.spawn_egg.type + " " + material.spawn_egg.skin
            };
            this.world.chat.sendMessage(player, chat_message);
            return false;
        }
        let blockKey = this.getBlockKey(params.pos);
        // 4. Если на этом месте есть сущность, тогда запретить ставить что-то на это место
        const existing_item = this.world.entities.getEntityByPos(params.pos);
        if (existing_item) {
            let restore_item = true;
            switch (existing_item.type) {
                case 'chest': {
                    let slots = existing_item.entity.slots;
                    if(slots && Object.keys(slots).length > 0) {
                        new_item = existing_item.entity.item;
                    } else {
                        restore_item = false;
                        this.world.entities.delete(existing_item.entity.item.entity_id, params.pos);
                    }
                    break;
                }
                default: {
                    // этот случай ошибочный, такого не должно произойти
                    new_item = this.modify_list.get(blockKey);
                }
            }
            if(restore_item) {
                params.item = new_item;
                let packets = [{
                    name: ServerClient.CMD_BLOCK_SET,
                    data: params
                }];
                this.world.sendSelected(packets, [player.session.user_id], []);
                return false;
            }
        }
        // 5. Create entity
        switch(material.id) {
            case BLOCK_CHEST: {
                new_item.entity_id = await this.world.entities.createChest(this.world, player, params);
                if (!new_item.entity_id) {
                    return false;
                }
                break;
            }
        }
        // Список всех устанавливаемых блоков
        const items = [{pos: pos, item: new_item}];
        // Check action
        switch(params.action_id) {
            case ServerClient.BLOCK_ACTION_REPLACE:
            case ServerClient.BLOCK_ACTION_CREATE: {
                if(!is_creative) {
                    const current_item = player.inventory.current_item;
                    if(!current_item || current_item.count < 1) {
                        throw 'error_material_not_enough';
                    }
                }
                player.inventory.decrement();
                // Если этот блок имеет "пару"
                if(material.next_part) {
                    let item = {...new_item};
                    item.id = material.next_part.id;
                    items.push({pos: pos.add(material.next_part.offset_pos), item: item});
                }
                break;
            }
        }
        //
        if(return_items) {
            return items;
        }
        await this.world.setBlocksApply(items);
        //
        return true;
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
                    await this.world.setBlocksApply([
                        {pos: item_pos, item: BLOCK.AIR},
                        {pos: under1.posworld, item: BLOCK.AIR},
                        {pos: under2.posworld, item: BLOCK.AIR}
                    ]);
                }
                break;
            }
        }
    }

    //
    sendAll(packets, except_players) {
        let connections = Array.from(this.connections.keys());
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
        return BLOCK.convertItemToInventoryItem(block);
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
    }

}