import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_BLOCKS} from "../www/js/chunk.js";
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
        //
        this.world.chunks.postWorkerMessage(['createChunk', {
            size:           this.size,
            coord:          this.coord,
            addr:           this.addr,
            modify_list:    Object.fromEntries(this.modify_list)
        }]);
        //
        this.mobs           = await this.world.db.loadMobs(this.addr, this.size);
        this.setState(CHUNK_STATE_LOADED);
        // Разошлем чанк игрокам, которые его запросили
        if(this.preq.size > 0) {
            this.sendToPlayers(Array.from(this.preq.keys()));
            this.preq.clear();
        }
        // Разошлем мобов всем игрокам, которые "контроллируют" данный чанк
        if(this.connections.size > 0 && this.mobs.size > 0) {
            this.sendMobs(Array.from(this.connections.keys()));
        }
    }

    // Add player connection
    addPlayer(player) {
        this.connections.set(player.session.user_id, player);
        player.addChunk(this);
    }

    // Добавление игрока, которому после прогрузки чанка нужно будет его отправить
    addPlayerLoadRequest(player) {
        if(this.load_state > CHUNK_STATE_LOADING) {
            this.sendToPlayers([player.session.user_id]);
            this.sendMobs(Array.from(this.connections.keys()));
        } else {
            this.preq.set(player.session.user_id, player);
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

    // Return block key
    getBlockKey(pos) {
        return new Vector(pos).toHash();
    }

    // Set block
    async blockSet(player, params, notify_author) {
        if(!this.connections.has(player.session.user_id)) {
            this.addPlayer(player);
        }
        if(BLOCK.isEgg(params.item.id)) {
            let material = BLOCK.fromId(params.item.id);
            // @ParamChatSendMessage
            let chat_message = {
                username: player.session.username,
                text:     "/spawnmob " + (params.pos.x + ".5 ") + params.pos.y + " " + (params.pos.z + ".5 ") + material.spawn_egg.type + " " + material.spawn_egg.skin
            };
            this.world.chat.sendMessage(player, chat_message);
            return false;
        }
        let blockKey = this.getBlockKey(params.pos);
        // Если на этом месте есть сущность, тогда запретить ставить что-то на это место
        let item = this.world.entities.getEntityByPos(params.pos);
        if (item) {
            switch (item.type) {
                case 'chest': {
                    params.item = item.entity.item; // this.ModifyList[blockKey]
                    break;
                }
                default: {
                    // этот случай ошибочный, такого не должно произойти
                    params.item = this.modify_list.get(blockKey);
                }
            }
            let packets = [{
                name: ServerClient.CMD_BLOCK_SET,
                data: params
            }];
            this.world.sendSelected(packets, [player.session.user_id], [])
            return false;
        }
        // Create entity
        switch (params.item.id) {
            case BLOCK_CHEST: {
                params.item.entity_id = await this.world.entities.createChest(this.world, player, params);
                if (!params.item.entity_id) {
                    return false;
                }
                break;
            }
        }
        //
        this.modify_list.set(blockKey, params.item);
        // Send to users
        let packets = [{
            name: ServerClient.CMD_BLOCK_SET,
            data: params
        }];
        this.sendAll(packets);
        return true;
    }

    //
    sendAll(packets) {
        let connections = Array.from(this.connections.keys());
        this.world.sendSelected(packets, connections, []);
    }

    // onBlocksGenerated ... Webworker callback method
    onBlocksGenerated(args) {
        this.tblocks            = new TypedBlocks();
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
        this.setState(CHUNK_STATE_BLOCKS_GENERATED);
    }

    getChunkManager() {
        return this.world.chunks;
    }

    // Get the type of the block at the specified position.
    // Mostly for neatness, since accessing the array
    // directly is easier and faster.
    getBlock(pos) {
        if(this.load_state != CHUNK_STATE_BLOCKS_GENERATED) {
            return this.getChunkManager().DUMMY;
        }
        pos = pos.floored().sub(this.coord);
        if(pos.x < 0 || pos.y < 0 || pos.z < 0 || pos.x >= this.size.x || pos.y >= this.size.y || pos.z >= this.size.z) {
            return this.getChunkManager().DUMMY;
        }
        let block = this.tblocks.get(pos);
        return block;
    }

    // Before unload chunk
    async onUnload() {
        if(this.mobs.size > 0) {
            for(let [entity_id, mob] of this.mobs) {
                mob.onUnload();
            }
        }
    }

}