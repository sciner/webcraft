import { CHUNK_STATE_BLOCKS_GENERATED } from "../server_chunk.js";
import { FSMStack } from "./stack.js";

import { PrismarinePlayerControl } from "../../www/vendors/prismarine-physics/using.js";
import { Vector } from "../../www/js/helpers.js";
import { getChunkAddr } from "../../www/js/chunk.js";
import { ServerClient } from "../../www/js/server_client.js";
import { Raycaster, RaycasterResult } from "../../www/js/Raycaster.js";

const FORWARD_DISTANCE = 20;

export class FSMBrain {

    #pos;
    #chunk_addr = new Vector();
    #_temp = {
        vec_ahead: new Vector(0, 0, 0),
        vec_add: new Vector(0, 0, 0)
    }

    constructor(mob) {
        this.mob = mob;
        this.stack = new FSMStack();
        this.raycaster = new Raycaster(mob.getWorld());
        this.rotateSign = 1;
        this.#pos = new Vector(0, 0, 0);
        this.run = false;
        this.target = null;
        this.angleRotation = 0;
        this.painicTime = 0;
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
        if (chunk && chunk.load_state == CHUNK_STATE_BLOCKS_GENERATED) {
            // tick
            this.stack.tick(delta, this);
        }
    }

    /**
     * @param {FSMBrain} brain
     * @param {object} options
     * @return {PrismarinePlayerControl}
     */
    createPlayerControl(brain, options) {
        let mob = brain.mob;
        let world = mob.getWorld();
        return new PrismarinePlayerControl({
            chunkManager: {
                chunk_addr: new Vector(),
                getBlock: (x, y, z) => {
                    let pos = new Vector(x, y, z).floored();
                    this.chunk_addr = getChunkAddr(pos, this.chunk_addr);
                    let chunk = world.chunks.get(this.chunk_addr);
                    if (chunk && chunk.load_state == CHUNK_STATE_BLOCKS_GENERATED) {
                        return chunk.getBlock(pos);
                    } else {
                        return world.chunks.DUMMY;
                    }
                }
            }
        }, mob.pos, options);
    }

    // Send current mob state to players
    sendState() {
        const mob = this.mob;
        const world = mob.getWorld();
        const chunk_over = world.chunks.get(mob.chunk_addr);
        if (!chunk_over) {
            return;
        }
        let new_state = {
            id:         mob.id,
            extra_data: mob.extra_data, // { is_alive: mob.isAlive() },
            rotate:     mob.rotate.multiplyScalar(1000).roundSelf().divScalar(1000),
            pos:        mob.pos.multiplyScalar(1000).roundSelf().divScalar(1000)
        };
        let need_send = true;
        if (mob.prev_state) {
            if (mob.prev_state.rotate.equal(new_state.rotate)) {
                if (mob.prev_state.pos.equal(new_state.pos)) {
                    let all_extas_equal = true;
                    const checked_extras = ['is_alive', 'detonation_started'];
                    for(let i = 0; i < checked_extras.length; i++) {
                        const field_name = checked_extras[i];
                        if (mob.prev_state.extra_data[field_name] != new_state.extra_data[field_name]) {
                            all_extas_equal = false;
                            break;
                        }
                    }
                    if(all_extas_equal) {
                        need_send = false;
                    }
                }
            }
        }
        if (need_send) {
            mob.prev_state = new_state;
            mob.prev_state.rotate = mob.prev_state.rotate.clone();
            mob.prev_state.pos = mob.prev_state.pos.clone();
            mob.prev_state.extra_data = JSON.parse(JSON.stringify(mob.prev_state.extra_data));
            let packets = [{
                name: ServerClient.CMD_MOB_UPDATE,
                data: new_state
            }];
            world.packets_queue.add(Array.from(chunk_over.connections.keys()), packets);
            // world.sendSelected(packets, Array.from(chunk_over.connections.keys()), []);
        }
    }

    // Update state and send to players
    updateControl(new_states) {
        let pc = this.pc;
        for (let [key, value] of Object.entries(new_states)) {
            switch (key) {
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
        pc.tick(delta * (this.run ? 4 : 1));
        this.mob.pos.copyFrom(pc.player.entity.position);
    }

    // Return players near pos by distance
    getPlayersNear(pos, max_distance, not_in_creative) {
        const world = this.mob.getWorld();
        return world.getPlayersNear(pos, max_distance, not_in_creative);
    }

    angleTo(target) {
        let pos = this.mob.pos;
        let angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle + 2 * Math.PI;
    }
    
    findTarget(){
        return false;
    }
    
    isStand(chance) {
        if (Math.random() < chance) {
            // console.log("[AI] mob " + this.mob.id + " stand");
            this.stack.replaceState(this.doStand);
            return true;
        }
        return false;
    }

    isForward(chance) {
        if (Math.random() < chance) {
            //console.log("[AI] mob " + this.mob.id + " forward");
            this.stack.replaceState(this.doForward);
            return true;
        }
        return false;
    }

    isRotate(chance, angle = -1) {
        if (Math.random() < chance) {
            //console.log("[AI] mob " + this.mob.id + " rotate");
            this.angleRotation = (angle == -1) ? 2 * Math.random() * Math.PI : angle;
            this.stack.replaceState(this.doRotate);
            return true;
        }
        return false;
    }

    isRespawn() {
        let mob = this.mob;

        if (this.isAggrressor && this.target != null || !mob.pos_spawn) {
            return false;
        }

        let dist = mob.pos.distance(mob.pos_spawn);

        if (dist > FORWARD_DISTANCE) {
            //console.log("[AI] mob " + mob.id + " go to respawn");
            this.isRotate(1.0, this.angleTo(this.mob.pos_spawn));
            return true;
        }
        return false;
    }

    onPanic(pos) {
        const mob = this.mob;
        this.run = true;
        this.panicTime = performance.now();
        mob.rotate.z = this.angleTo(pos) + Math.PI;
        this.stack.replaceState(this.doPanic);
	}

    doPanic(delta) {
        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: true,
            jump: this.checkInWater()
        });
        this.applyControl(delta);
        this.sendState();
        let time = performance.now() - this.panicTime;
        if (time > 3000) {
            this.run = false;
            this.isStand(1.0);
        }
    }

    doStand(delta) {
        this.updateControl({
            jump: this.checkInWater(),
            forward: false
        });

        this.applyControl(delta);
        this.sendState();
        
        if (this.findTarget()){
            return;
        }

        if (this.isRespawn()) {
            return;
        }

        if (this.isForward(0.02)) {
            return;
        }

        if (this.isRotate(0.01)) {
            return;
        }
    }

    doForward(delta) {
        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: true,
            jump: this.checkInWater()
        });

        const pick = this.raycastFromHead();
        if (pick) {

        }

        this.applyControl(delta);
        this.sendState();
        
        if (this.findTarget()){
            return;
        }

        if (this.isStand(0.01)) {
            return;
        }
    }

    //
    doRotate(delta) {
        this.updateControl({
            forward: false,
            jump: this.checkInWater()
        });

        if (Math.abs((this.mob.rotate.z % (2 * Math.PI)) - this.angleRotation) > 0.5) {
            this.mob.rotate.z += delta * ((this.run) ? 2 : 1);
        } else {
            this.isForward(1.0);
            return;
        }

        this.applyControl(delta);
        this.sendState();
        
        if (this.findTarget()){
            return;
        }
    }

    //
    checkInWater() {
        let mob = this.mob;
        let world = mob.getWorld();
        let chunk_over = world.chunks.get(mob.chunk_addr);
        if (!chunk_over) {
            return false;
        }
        let block = chunk_over.getBlock(mob.pos.floored());
        return block.material.is_fluid;
    }

    /**
    * Моба убили
    * owner - игрок или пероснаж
    * type - от чего умер[упал, сгорел, утонул]
    */
    onKill(owner, type) {
    }
    
    /**
    * Использовать предмет на мобе
    * owner - игрок
    * item - item
    */
    onUse(owner, item){
    }
    
    
    /**
    * Нанесен урон по мобу
    * owner - игрок или пероснаж
    * val - количество урона
    * type - от чего умер[упал, сгорел, утонул]
    */
    onDemage(owner, val, type){
        const mob = this.mob;
        const pos_owner = (owner.session) ? owner.state.pos : new Vector(0,0,0);
        let velocity = mob.pos.sub(pos_owner).normSelf();
        velocity.y = .5;
        mob.addVelocity(velocity);
        this.onPanic(pos_owner);
    }
}