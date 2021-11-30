import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../www/js/chunk.js";
import {ServerClient} from "../www/js/server_client.js";
import {Vector} from "../www/js/helpers.js";
import {BLOCK} from "../www/js/blocks.js";

export class ServerChunk {

    constructor(world, addr) {
        this.world          = world;
        this.addr           = new Vector(addr);
        this.size           = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        this.connections    = new Map();
        this.modify_list    = new Map();
        this.mobs           = new Map();
    }

    // Load state from DB
    async load() {
        this.modify_list = await this.world.db.loadChunkModifiers(this.addr, this.size);
        this.mobs = await this.world.db.loadMobs(this.addr, this.size);
    }

    // Add player connection
    addPlayer(player) {
        this.connections.set(player.session.user_id, player);
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

    // Chunk loaded
    loaded(player) {
        // @CmdChunkState
        let packets = [{
            name: ServerClient.CMD_CHUNK_LOADED,
            data: {
                addr:        this.addr,
                modify_list: Object.fromEntries(this.modify_list),
            }
        }];
        this.world.sendSelected(packets, [player.session.user_id], []);
        // Send all mobs in this chunk
        if (this.mobs.size > 0) {
            let packets_mobs = [{
                name: ServerClient.CMD_MOB_ADDED,
                data: []
            }];
            for(const [_, mob] of this.mobs) {
                packets_mobs[0].data.push(mob);
            }
            this.world.sendSelected(packets_mobs, [player.session.user_id], []);
        }
        return true
    }

    // Return block key
    getBlockKey(pos) {
        return new Vector(pos).toHash();
    }

    // Set block
    async blockSet(player, params, notify_author) {
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

}