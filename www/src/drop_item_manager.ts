import {ServerClient} from "./server_client.js";
import Mesh_Object_Block_Drop from "./mesh/object/block_drop.js";
import { DROP_LIFE_TIME_SECONDS } from "./constant.js";

export class DropItemManager {
    [key: string]: any;

    #world;

    constructor(world) {
        this.#world = world;
        this.list = new Map();
    }

    // Client side method
    init() {
        // On server message
        this.#world.server.AddCmdListener([ServerClient.CMD_DROP_ITEM_ADDED, ServerClient.CMD_DROP_ITEM_UPDATE, ServerClient.CMD_DROP_ITEM_DELETED], (cmd) => {
            switch(cmd.name) {
                case ServerClient.CMD_DROP_ITEM_ADDED: {
                    for(let drop_item of cmd.data) {
                        this.add(drop_item, cmd.time);
                    }
                    break;
                }
                case ServerClient.CMD_DROP_ITEM_UPDATE:
                case ServerClient.CMD_DROP_ITEM_FULL_UPDATE: {
                    let drop_item = this.list.get(cmd.data.entity_id);
                    if(drop_item) {
                        // drop_item.pos.y = cmd.data.pos.y;
                        drop_item.applyNetState({
                            pos: cmd.data.pos,
                            time: cmd.time
                        });
                        if (cmd.name === ServerClient.CMD_DROP_ITEM_FULL_UPDATE) {
                            drop_item.items = cmd.data.items;
                            drop_item.dt = cmd.data.dt;
                        }
                    } else {
                        // Drop item not found
                    }
                    break;
                }
                case ServerClient.CMD_DROP_ITEM_DELETED: {
                    for(let drop_item_id of cmd.data) {
                        this.delete(drop_item_id);
                    }
                    break;
                }
            }
        });
    }

    // add
    add(data, time) {
        if(data.items[0].id < 1) return;
        const drop_item = new Mesh_Object_Block_Drop(null, data.entity_id, data.items, data.pos);
        drop_item.world = this.#world;
        drop_item.dt = data.dt;
        drop_item.deathTime = data.dt + DROP_LIFE_TIME_SECONDS;
        drop_item.applyNetState({
            pos: data.pos,
            time: time
        });

        this.list.set(data.entity_id, drop_item);
    }

    // get
    get(id) {
        if(!this.list.has(id)) {
            return null;
        }
        return this.list.get(id);
    }

    // delete
    delete(id) {
        this.list.delete(id);
    }

}