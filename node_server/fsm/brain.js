import {CHUNK_STATE_BLOCKS_GENERATED} from "../server_chunk.js";
import {FSMStack} from "./stack.js";

import { PrismarinePlayerControl, PHYSICS_TIMESTEP} from "../../www/vendors/prismarine-physics/using.js";
import { Vector } from "../../www/js/helpers.js";
import { getChunkAddr } from "../../www/js/chunk.js";
import { ServerClient } from "../../www/js/server_client.js";
import { Raycaster, RaycasterResult } from "../../www/js/Raycaster.js";

export class FSMBrain {

    #pos;
    #chunk_addr = new Vector();

    constructor(mob) {
        this.mob            = mob;
        this.stack          = new FSMStack();
        this.raycaster      = new Raycaster(mob.getWorld());
        this.rotateSign     = 1;
        this.#pos           = new Vector(0, 0, 0);
    }

    /**
     * @returns {null | RaycasterResult}
     */
    raycastFromHead() {
        const mob = this.mob;
        this.#pos.set(
            mob.pos.x,
            mob.pos.y + this.pc.physics.playerHeight * 0.8,
            mob.pos.z
        );
        return this.raycaster.get(this.#pos, mob.forward, 100);
    }

    tick(delta) {
        const world = this.mob.getWorld();
        this.#chunk_addr = getChunkAddr(this.mob.pos, this.#chunk_addr);
        let chunk = world.chunks.get(this.#chunk_addr);
        if(chunk && chunk.load_state == CHUNK_STATE_BLOCKS_GENERATED) {
            // tick
            this.stack.tick(delta, this);
        }
    }

    /**
     * @param {FSMBrain} brain 
     * @param {number} base_speed 
     * @param {number} playerHeight 
     * @param {number} stepHeight 
     * @return {PrismarinePlayerControl}
     */
    createPlayerControl(brain, base_speed, playerHeight, stepHeight) {
        let mob = brain.mob;
        let world = mob.getWorld();
        return new PrismarinePlayerControl({
            chunkManager: {
                chunk_addr: new Vector(),
                getBlock: (x, y, z) => {
                    let pos = new Vector(x, y, z).floored();
                    this.chunk_addr = getChunkAddr(pos, this.chunk_addr);
                    let chunk = world.chunks.get(this.chunk_addr);
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

        this.updateControl({
            jump: this.checkInWater(),
            forward: false
        });

        this.applyControl(delta);
        this.sendState();

        let r = Math.random() * 5000;
        if(r < 200) {
            if(r < 100) {
                // Random rotate
                this.rotateSign = Math.sign(Math.random() - Math.random());
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
            return false;
        }
        let block = chunk_over.getBlock(mob.pos.floored());
        return block.material.is_fluid;
    }

    // Rotate
    doRotate(delta) {

        this.updateControl({forward: false, jump: this.checkInWater()});

        let mob = this.mob;

        /*
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
        }
        */

        mob.rotate.z += delta * this.rotateSign;

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

        this.updateControl({
            yaw: mob.rotate.z,
            forward: true,
            jump: this.checkInWater()
        });

        const pick = this.raycastFromHead();
        if (pick) {
            let block = this.mob.getWorld().chunkManager.getBlock(pick.x, pick.y, pick.z);
            if(block && !block.material.planting) {
                let dist = mob.pos.distance(new Vector(pick.x + .5, pick.y, pick.z + .5));
                if(dist < 1.0) {
                    // console.log('Mob pick at block: ', block.material.name, dist);
                    this.rotateSign = Math.sign(Math.random() - Math.random());
                    this.stack.replaceState(this.doRotate); // push new state, making it the active state.
                    this.sendState();
                    return;
                }
            }
        }

        if(Math.random() * 5000 < 200) {
            this.stack.replaceState(this.standStill); // push new state, making it the active state.
            this.sendState();
            return;
        }

        this.applyControl(delta);
        this.sendState();

    }
 
}