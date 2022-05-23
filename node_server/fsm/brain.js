import {CHUNK_STATE_BLOCKS_GENERATED} from "../server_chunk.js";
import { FSMStack } from "./stack.js";

import { PrismarinePlayerControl, PHYSICS_TIMESTEP} from "../../www/vendors/prismarine-physics/using.js";
import { Vector, Mth } from "../../www/js/helpers.js";
import { getChunkAddr } from "../../www/js/chunk.js";
import { ServerClient } from "../../www/js/server_client.js";
import { Raycaster, RaycasterResult } from "../../www/js/Raycaster.js";

export class FSMBrain {

    #pos;
    #chunk_addr = new Vector();
    #_temp = {
        vec_ahead: new Vector(0, 0, 0),
        vec_add: new Vector(0, 0, 0)
    }

    constructor(mob) {
        this.mob            = mob;
        this.stack          = new FSMStack();
        this.raycaster      = new Raycaster(mob.getWorld());
        this.rotateSign     = 1;
        this.#pos           = new Vector(0, 0, 0);
        this.panic          = false;
        this.target = null;
        this.rad = 0;
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
                    if(chunk && chunk.load_state == CHUNK_STATE_BLOCKS_GENERATED) {
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
        let mob = this.mob;
        let world = mob.getWorld();
        let chunk_over = world.chunks.get(mob.chunk_addr);
        if(!chunk_over) {
            return;
        }
        let new_state = {
            id:         mob.id,
            extra_data: {is_alive: mob.isAlive()},
            rotate:     mob.rotate.multiplyScalar(1000).roundSelf().divScalar(1000),
            pos:        mob.pos.multiplyScalar(1000).roundSelf().divScalar(1000)
        };
        let need_send = true;
        if(mob.prev_state) {
            if(mob.prev_state.rotate.equal(new_state.rotate)) {
                if(mob.prev_state.pos.equal(new_state.pos)) {
                    if(mob.prev_state.extra_data.is_alive == new_state.extra_data.is_alive) {
                        need_send = false;
                    }
                }
            }
        }
        if(need_send) {
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
        pc.tick(delta * (this.panic ? 3 : 1));
        this.mob.pos.copyFrom(pc.player.entity.position);
    }

    getConnections(pos) {
       // let connections = new Map();

        let connections = [];
        let chunk_addr;
        chunk_addr = getChunkAddr(pos, chunk_addr);
        for (let x = -3; x <= 3; x++) {
            for (let z = -3; z <= 3; z++) {
                let chunk = this.mob.getWorld().chunks.get({ 'x': chunk_addr.x + x, 'y': chunk_addr.y, 'z': chunk_addr.z + z });
                if (chunk != null && chunk.connections != null) {
                    for (let key of chunk.connections.keys()) { // то же самое, что и recipeMap.entries()
                        // connections.set(key, chunk.connections.get(key));
                        connections.push(key);
                    }
                }
            }
        }

        return connections;
	}

    angle(target) {
        let angle = Math.atan2(target.x - this.mob.pos.x, target.z - this.mob.pos.z);
        return (angle > 0) ? angle : angle + 2 * Math.PI;
    }

    findTarget() {
        if (this.isAggrressor && this.target == null) {
            let mob = this.mob;
            let connections = this.getConnections(mob.pos);
            let players = mob.getWorld().players;
            for (let id of connections) {
                let player = players.get(id);
                let dist = mob.pos.distance(player.state.pos);
                if (dist < 10) {
                    console.log("[AI] find target and go " + id);
                    this.target = id;
                    this.stack.replaceState(this.doCatch);
                    return true;
                }
			}
        }
        return false;
    }

    toRespawn() {
        let mob = this.mob;

        if (this.isAggrressor && this.target != null || !mob.pos_spawn) {
            return false;
        }
        
        let dist = mob.pos.distance(mob.pos_spawn);

        if (dist > 21) {
            console.log("[AI] mob " + mob.id + " go to respawn");
            this.runRotate(1.0, this.angle(this.mob.pos_spawn));
            return true;
        }
        return false;
    }

    runForward(chance) {
        if (Math.random() < chance) {
            console.log("[AI] mob " + this.mob.id + " forward");
            this.stack.replaceState(this.doForward);
            return true;
        }
        return false;
    }

    runStand(chance) {
        if (Math.random() < chance) {
            console.log("[AI] mob " + this.mob.id + " stand");
            this.stack.replaceState(this.doStand);
            return true;
        }
        return false;
    }

    runRotate(chance, angle = -1) {
        if (Math.random() < chance) {
            console.log("[AI] mob " + this.mob.id + " rotate");
            this.rad = (angle == -1) ? Math.random() * Math.PI : angle;
            this.stack.replaceState(this.doRotate);
            return true;
        }
        return false;
	}

    doStand(delta) {
        this.updateControl({
            jump: this.checkInWater(),
            forward: false
        });

        this.applyControl(delta);
        this.sendState();


        if (this.findTarget()) {
            return;
        }

        if (this.toRespawn()) {
            return;
        }

        if (this.runForward(0.02)) {
            return;
		}

        if (this.runRotate(0.01)) {
            return;
		}
    }

    setMobDie() {

	}

    doForward(delta) {
        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: true,
            jump: this.checkInWater()
        });

        this.applyControl(delta);
        this.sendState();

        if (this.findTarget()) {
            return;
        }

        if (this.runStand(0.01)) {
            return;
		}
    }

    doRotate(delta) {
        this.updateControl({
            forward: false,
            jump: this.checkInWater()
        });

        if (Math.abs((this.mob.rotate.z % (2 * Math.PI)) - this.rad) > 0.2) {
            this.mob.rotate.z += delta * 2;
        } else {
            this.runForward(1.0);
            return;
		}

        this.applyControl(delta);
        this.sendState();
    }

    async doCatch(delta) {
        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: true,
            jump: this.checkInWater()
        });

        let mob = this.mob;

        let player = mob.getWorld().players.get(this.target);

        let dist = mob.pos.distance(player.state.pos);
        if (dist > 15) {
            console.log("[AI] mob " + this.mob.id + " lost plasyer and stand");
            this.target = null;
            this.runStand(1.0);
            return
        }

        if (dist < 4) {
           /* this.mob.pos.y += 0.5;
            let actions = {
                blocks: {
                    list: [],
                    options: {
                        ignore_check_air: true,
                        on_block_set: false
                    }
                }
            };
            const rad = 20;
            const air = { id: 0 };
            for (let i = -rad; i < rad; i++) {
                for (let j = -rad; j < rad; j++) {
                    for (let k = -rad; k < rad; k++) {
                        const air_pos = new Vector(this.mob.pos.x + i, this.mob.pos.y + k, this.mob.pos.z + j).flooredSelf();
                        if (air_pos.distance(this.mob.pos) < rad) {
                            actions.blocks.list.push({ pos: air_pos, item: air });
                        }
                    }
                }
            }
            console.log(actions.blocks.list);
            console.log(player.state.pos);
            await this.mob.getWorld().applyActions(null, actions, false);
            this.stand(1.0)
            this.target = null;
            */
            mob.kill();
		}

        if (Math.random() < 0.5) {
            this.mob.rotate.z = this.angle(player.state.pos);
        }

        this.applyControl(delta);
        this.sendState();
    }

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





    /*
    doCatch(delta) {
        let mob = this.mob;
        let world = this.mob.getWorld();
        this.target = world.players.get(1001);
        if (this.target != null) {
            let pos = this.target.state.pos;
            let dist = this.distance(mob.pos, pos);
            if (dist < 10) {
                let angToCam = Math.atan2(pos.x - mob.pos.x, pos.z - mob.pos.z);
                angToCam = (angToCam > 0) ? angToCam : angToCam + 6.28;
                mob.rotate.z = angToCam;
                this.applyControl(delta);
                this.sendState();

                this.stack.replaceState(this.goForward);
            }
		}
    }

    angle(target) {
        let angToCam = Math.atan2(target.x - this.mob.pos.x, target.z - this.mob.pos.z);
        return (angToCam > 0) ? angToCam : angToCam + 6.28;
	}

    distance(target) {
        return Math.sqrt(Math.pow(target.x - this.mob.pos.x, 2) + Math.pow(target.z - this.mob.pos.z, 2) );
    }


    stand(delta) {
        /*
         * если встали, то можем развернуться или пойти
         
        this.updateControl({
            jump: this.checkInWater(),
            forward: false
        });


        if (this.isAggrressor) {
            let pos = this.mob.getWorld().players.get(1001).state.pos;
            let dist = this.distance(pos);
            if (dist < 10) {
                this.target = this.mob.getWorld().players.get(1001);
                this.mob.rotate.z = this.angle(pos);
                console.log("[AI] catch");
                this.stack.replaceState(this.catch);
			}
        }

        if (Math.random() * 5000 < 300) {
            console.log("[AI] forward");
            this.stack.replaceState(this.forward);
        }

        if (Math.random() * 5000 < 300) {
            console.log("[AI] forward");
            this.stack.replaceState(this.forward);
        }

        this.applyControl(delta);
        this.sendState();
    }

    catch(delta) {
        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: true,
            jump: this.checkInWater()
        });

        let dist = this.distance(this.target.state.pos);
        if (dist > 15) {
            console.log("[AI] stand");
            this.stack.replaceState(this.stand);
            this.target = null;
        }

        if ((Math.random() * 5000) < 300) {
            this.mob.rotate.z = this.angle(this.target.state.pos);
		}

        this.applyControl(delta);
        this.sendState();
    }

    forward(delta) {
        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: true,
            jump: this.checkInWater()
        });

        if (Math.random() * 5000 < 300) {
            console.log("[AI] rotate");
            this.stack.replaceState(this.rotate);
        }

        if (Math.random() * 5000 < 300) {
            console.log("[AI] stand");
            this.stack.replaceState(this.stand);
        }

        this.applyControl(delta);
        this.sendState();
    }

    rotate(delta) {
        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: false,
            jump: this.checkInWater()
        });

        this.mob.rotate.z += (delta * (this.panic ? 25 : 1));

        if (Math.random() * 5000 < 30) {
            console.log("[AI] forward");
            this.stack.replaceState(this.forward);
        }

        this.applyControl(delta);
        this.sendState();
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
        if(r < 500 || this.panic) {
            if(r < 100 || this.panic) {
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

    doRotate(delta) {
        this.updateControl({ forward: false, jump: this.checkInWater() });

        let mob = this.mob;
        if (this.isAggrressor) {
            let time = Math.round(Date.now());
            //if ((time % 50) == 0) {
                let pos = this.mob.getWorld().players.get(1001).state.pos;
                let radius = Math.sqrt(Math.pow((pos.z - mob.pos.z), 2) + Math.pow((pos.x - mob.pos.x), 2));
                if (radius < 1000) {
                    let angToCam = Math.atan2(pos.x - mob.pos.x, pos.z - mob.pos.z);
                    angToCam = (angToCam > 0) ? angToCam : angToCam + 6.28;
                    mob.rotate.z = angToCam;

                    this.applyControl(delta);
                    this.sendState();

                    this.stack.replaceState(this.goForward);
                    return;
				}
            //}
        }

        mob.rotate.z += (delta * (this.panic ? 25 : 1));
        this.applyControl(delta);
        this.sendState();
        if (this.panic) {
            this.stack.replaceState(this.goForward);
            return;
        } else {
            if (Math.random() * 5000 < 300) {
                this.stack.replaceState(this.standStill);
                return;
             }
        }
        /*
        let pos = this.mob.getWorld().players.get(1001).state.pos;
        let mob = this.mob;
        let angToCam = Math.atan2(pos.x - mob.pos.x, pos.z - mob.pos.z);
        angToCam = (angToCam > 0) ? angToCam : angToCam + 6.28;
        if (Math.pow((pos.z - mob.pos.z), 2) + Math.pow((pos.x - mob.pos.x), 2) < 100)
        {
            console.log(this.isAggrressor)
            if (Math.abs((mob.rotate.z % 6.28) - angToCam) < 0.4) {
                this.stack.replaceState(this.goForward);
                return;
			}
		}
            //console.log(angToCam + " " + (mob.rotate.z % 6.28));

        this.updateControl({ forward: false, jump: this.checkInWater() });
        mob.rotate.z += (delta * 1);

        this.applyControl(delta);
        this.sendState();
        
	}

    // Rotate
    doRotate3(delta) {

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
        

        mob.rotate.z += (delta * (this.panic ? 25 : 1)) * this.rotateSign;

        this.applyControl(delta);
        this.sendState();

        if(this.panic) {
            this.stack.replaceState(this.goForward);
            return;
        } else {
            if(Math.random() * 5000 < 300) {
                this.stack.replaceState(this.standStill);
                return;
            }
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

        // Do not enter liquids and do not fall
        if(this.checkDangerAhead()) {
            this.rotateSign = Math.sign(Math.random() - Math.random());
            this.stack.replaceState(this.doRotate); // push new state, making it the active state.
            this.sendState();
            return;
        }

        const pick = this.raycastFromHead();
        if (pick) {
            let block = this.mob.getWorld().chunkManager.getBlock(pick.x, pick.y, pick.z);
            if(block && !block.material.planting) {
                let dist = mob.pos.distance(new Vector(pick.x + .5, pick.y, pick.z + .5));
                if(dist < .5 + this.mob.width) {
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

        if (Math.random() * 5000 < 200) {
            this.stack.replaceState(this.doRotate); // push new state, making it the active state.
            this.sendState();
            return;
        }

        this.applyControl(delta);
        this.sendState();

    }

    // Do not enter liquids and do not fall
    checkDangerAhead() {
        const mob = this.mob;
        // 1. do not enter liquids
        const pos_ahead = this.#_temp.vec_ahead.copyFrom(mob.pos)
            .addSelf(this.#_temp.vec_add.set(Math.sin(mob.rotate.z), 0, Math.cos(mob.rotate.z)))
            .flooredSelf()
        const block_ahead = this.mob.getWorld().chunkManager.getBlock(pos_ahead);
        if(block_ahead.material.is_fluid || block_ahead.material.is_fire) {
            return true;
        }
        //
        pos_ahead.y--;
        let block = this.mob.getWorld().chunkManager.getBlock(pos_ahead);
        if(block.material.is_fluid || block.material.is_fire) {
            return true;
        }
        // 2. do not fall
        if(block.id == 0) {
            pos_ahead.y--;
            block = this.mob.getWorld().chunkManager.getBlock(pos_ahead);
            if(block.id == 0 || block.material.is_fire || block.material.is_fluid) {
                return true;
            }
        }
        return false;
    }
    */
}