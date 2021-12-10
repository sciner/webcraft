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
        this.stack.tick(delta, this);
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

    // Send current mob state to players
    sendState() {
        let mob = this.mob;
        let world = mob.getWorld();
        let chunk_over = world.chunks.get(mob.chunk_addr);
        if(!chunk_over) {
            return;
        }
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

    // Update state and send to players
    updateControl(new_states) {
        let pc = this.pc;
        for(let [key, value] of Object.entries(new_states)) {
            switch(key) {
                case 'yaw': {
                    pc.player_state[key] = value;
                    break;
                }
                default: {
                    pc.controls[key] = value;
                    break;
                }
            }
        }
    }

    applyControl(delta) {
        let pc = this.pc;
        pc.tick(delta);
        this.mob.pos.copyFrom(pc.player.entity.position);
    }

    // Stand still
    standStill(delta) {

        if(this.checkInWater()) {
            this.updateControl({jump: true});
            this.applyControl(delta);
            this.sendState();
        }

        this.updateControl({jump: false, forward: false});

        let r = Math.random() * 5000;
        if(r < 200) {
            if(r < 100) {
                // Random rotate
                this.stack.replaceState(this.doRotate); // push new state, making it the active state.
            } else {
                // Go forward
                this.stack.replaceState(this.goForward);
            }
        }
    }

    // Check mob if in water
    checkInWater() {
        let mob = this.mob;
        let world = mob.getWorld();
        let chunk_over = world.chunks.get(mob.chunk_addr);
        if(!chunk_over) {
            return;
        }
        let block = chunk_over.getBlock(mob.pos.floored());
        return block.material.is_fluid;
    }

    // Rotate
    doRotate(delta) {

        if(this.checkInWater()) {
            this.updateControl({jump: true});
        }
        this.updateControl({jump: false, forward: false});

        let mob = this.mob;
        let world = mob.getWorld();

        let camPos = null;
        for(let player of world.players.values()) {
            if(player.state.pos.distance(mob.pos) < 5) {
                camPos = player.state.pos;
                break;
            }
        }

        if(camPos) {
            // @todo angle to cam
            // let angToCam = -Math.PI/2 - Math.atan2(camPos.z - mob.pos.z, camPos.x - mob.pos.x) + Math.PI;
            // mob.rotate.z = angToCam;
            mob.rotate.z += delta;
        } else {
            mob.rotate.z += delta;
        }

        this.applyControl(delta);
        this.sendState();

        if(Math.random() * 5000 < 300) {
            this.stack.replaceState(this.standStill);
            return;
        }
    }

    // Go forward
    goForward(delta) {

        let mob = this.mob;
        let world = mob.getWorld();

        let chunk_over = world.chunks.get(mob.chunk_addr);
        if(!chunk_over) {
            return;
        }

        if(chunk_over.load_state != CHUNK_STATE_BLOCKS_GENERATED) {
            return;
        }

        this.checkInWater();
        this.updateControl({yaw: mob.rotate.z, forward: true});

        if(Math.random() * 5000 < 200) {
            this.stack.replaceState(this.standStill); // push new state, making it the active state.
            this.sendState(chunk_over);
            return;
        }

        this.applyControl(delta);
        this.sendState();

    }
 
}