import {ServerClient} from "./server_client.js";
import Mesh_Object_Block_Drop from "./mesh/object/block_drop.js";
import { DROP_LIFE_TIME_SECONDS } from "./constant.js";
import type { World } from "./world.js";

/** Data of one drop item sent to the client. */
export type DropItemPacket = {
    entity_id   : string
    items
    pos         : IVector
    dt          : int       // unixTime()
    delayUserId ? : int     // id of a user that has pickup delay for this item
}

export class DropItemManager {

    #world: World;
    list: Map<string, Mesh_Object_Block_Drop> // by entity_id

    constructor(world: World) {
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
    add(data: DropItemPacket, time: number) {
        if(data.items[0].id < 1) return;
        const drop_item = new Mesh_Object_Block_Drop(null, data.entity_id, data.items, data.pos);
        drop_item.world = this.#world;
        drop_item.dt = data.delayUserId === Qubatch.player.session.user_id
            ? data.dt
            : -Infinity
        drop_item.deathTime = data.dt + DROP_LIFE_TIME_SECONDS;
        drop_item.applyNetState({
            pos: data.pos,
            time: time
        });

        this.list.set(data.entity_id, drop_item);
    }

    // get
    get(entity_id: string): Mesh_Object_Block_Drop | null {
        return this.list.get(entity_id) ?? null;
    }

    // delete
    delete(entity_id: string) {
        this.list.delete(entity_id);
    }

}