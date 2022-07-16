import { CHUNK_STATE_BLOCKS_GENERATED } from "../server_chunk.js";
import { FSMStack } from "./stack.js";
import { PrismarinePlayerControl } from "../../www/vendors/prismarine-physics/using.js";
import { getChunkAddr, Vector } from "../../www/js/helpers.js";
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
        this.#pos = new Vector(0, 0, 0);
        this.panick_timer = 0;
        this.target = null;
        this.rotate_angle = 0;
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
        pc.tick(delta * (this.panick_timer > 0 ? 4 : 1));
        this.mob.pos.copyFrom(pc.player.entity.position);
    }

    // Return players near pos by distance
    getPlayersNear(pos, max_distance, not_in_creative) {
        const world = this.mob.getWorld();
        return world.getPlayersNear(pos, max_distance, not_in_creative);
    }

    angleTo(target) {
        const pos = this.mob.pos;
        const angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle + 2 * Math.PI;
    }

    getBeforeBlocks() {
        const mob = this.mob;
        const world = mob.getWorld();
        const chunk_over = world.chunks.get(mob.chunk_addr);
        if (!chunk_over) {
            return null;
        }
        const pos_head = mob.pos.add(new Vector(Math.sin(mob.rotate.z), this.height + 1, Math.cos(mob.rotate.z)));
        const pos_body = mob.pos.add(new Vector(Math.sin(mob.rotate.z), this.height / 2, Math.cos(mob.rotate.z)));
        const pos_legs = mob.pos.add(new Vector(Math.sin(mob.rotate.z), -1, Math.cos(mob.rotate.z)));
        const pos_under = mob.pos.add(new Vector(Math.sin(mob.rotate.z), -2, Math.cos(mob.rotate.z)));
        const head = chunk_over.getBlock(pos_head);
        const body = chunk_over.getBlock(pos_body);
        const legs = chunk_over.getBlock(pos_legs);
        const under = chunk_over.getBlock(pos_under);
        return { 'head': head, 'body': body, 'legs': legs, 'under': under }
    }

    findTarget() {
        return false;
	}

    doStand(delta) {
        if (this.findTarget()) {
            return;
        }

        const block = this.getBeforeBlocks();
        if (!block) {
            return;
        }

        const is_water = block.body.material.is_fluid || block.head.material.is_fluid;
        const mob = this.mob;
        if (is_water) {
            this.rotate_angle += Math.PI / 60;
            mob.rotate.z = this.rotate_angle;
        }

        this.rotate_angle = Math.round((this.rotate_angle % 6.28) * 100 ) / 100;
        if (Math.abs(Math.abs(mob.rotate.z % 6.28) - this.rotate_angle) > 0.5) {
            mob.rotate.z += (this.panick_timer > 0 ? 1 : 0.2);
        } else {
            mob.rotate.z = this.rotate_angle;
            if (this.panick_timer > 0) {
                this.stack.replaceState(this.doForward);
            }
        }

        this.updateControl({
            yaw: mob.rotate.z,
            jump: is_water,
            forward: false
        });
        this.applyControl(delta);
        this.sendState();

        if (Math.random() < 0.05) {
            this.stack.replaceState(this.doForward);
        }
    }

    doForward(delta) {

        if (this.findTarget()) {
            return;
        }

        if (this.panick_timer > 0) {
            this.panick_timer--;
        }

        const block = this.getBeforeBlocks();
        if (!block) {
            return;
        }

        const mob = this.mob;
        const is_water = block.body.material.is_fluid;
        this.updateControl({
            yaw: mob.rotate.z,
            jump: is_water,
            forward: true
        });
        this.applyControl(delta);
        this.sendState();

        if (block.body.material.is_fluid) {
            return;
        }

        const is_abyss = (block.legs.id == 0 && block.under.id == 0) ? true : false;
        const is_water_legs = (block.legs.material.is_fluid) ? true : false;
        const is_fence = (block.body.material.style == "fence") ? true : false;
        const is_wall = (block.head.id != 0 && !block.head.material.planting) ? true : false;
        if (is_wall || is_fence || is_abyss || is_water_legs) {
            this.rotate_angle = mob.rotate.z + (Math.PI / 2) + Math.random() * Math.PI / 2;
            this.stack.replaceState(this.doStand);
            return;
        }

        if (Math.random() < 0.05 && this.panick_timer == 0) {
            if (Math.random() < 0.1) {
                this.rotate_angle = 2 * Math.random() * Math.PI;
            }
            this.stack.replaceState(this.doStand);
        }
    }

    onPanic() {
        const mob = this.mob;
        this.panick_timer = 80;
        this.target = null;
        mob.rotate.z = 2 * Math.random() * Math.PI;
        this.stack.replaceState(this.doStand);
    }

    /**
    * Моба убили
    * actor - игрок или пероснаж
    * type_damage - от чего умер[упал, сгорел, утонул]
    */
    onKill(actor, type_damage) {
    }
    
    /**
    * Использовать предмет на мобе
    * actor - игрок
    * item - item
    */
    onUse(actor, item){
    }
    
    
    /**
    * Нанесен урон по мобу
    * actor - игрок или пероснаж
    * val - количество урона
    * type_damage - от чего умер[упал, сгорел, утонул]
    */
    onDamage(actor, val, type_damage) {
        const mob = this.mob;
        const pos_actor = (actor.session) ? actor.state.pos : new Vector(0, 0, 0);
        let velocity = mob.pos.sub(pos_actor).normSelf();
        velocity.y = 0.5;
        mob.addVelocity(velocity);
        this.onPanic();
    }
}