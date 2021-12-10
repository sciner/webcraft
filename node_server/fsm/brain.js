import {CHUNK_STATE_NEW, CHUNK_STATE_LOADING, CHUNK_STATE_LOADED, CHUNK_STATE_BLOCKS_GENERATED} from "../server_chunk.js";
import {FSMStack} from "./stack.js";

import {PrismarinePlayerControl, PHYSICS_TIMESTEP} from "../../www/vendors/prismarine-physics/using.js";
import {Vector} from "../../www/js/helpers.js";
import {getChunkAddr} from "../../www/js/chunk.js";
import {ServerClient} from "../../www/js/server_client.js";

export class FSMBrain {

    constructor(mob) {
        this.mob = mob;
        this.stack = new FSMStack();
    }

    tick(delta) {
        this.stack.tick(delta);
    }

    createPlayerControl(brain, base_speed, playerHeight, stepHeight) {
        let mob = brain.mob;
        let world = mob.getWorld();
        return new PrismarinePlayerControl({
            chunkManager: {
                getBlock: (x, y, z) => {
                    let pos = new Vector(x, y, z).floored();
                    let chunk_addr = getChunkAddr(pos);
                    let chunk = world.chunks.get(chunk_addr);
                    if(chunk && chunk.load_state == CHUNK_STATE_BLOCKS_GENERATED) {
                        return chunk.getBlock(pos);
                    } else {
                        return world.chunks.DUMMY;
                    }
                }
            }
        }, mob.pos, base_speed, playerHeight, stepHeight);
    }

    sendState(chunk_over) {
        let mob = this.mob;
        let world = mob.getWorld();
        let packets = [{
            name: ServerClient.CMD_MOB_UPDATE,
            data: {
                id:       mob.id,
                rotate:   mob.rotate,
                pos:      mob.pos
            }
        }];
        world.sendSelected(packets, Array.from(chunk_over.connections.keys()), []);
    }
 
}