import {FSMBrain} from "../brain.js";

import { Vector } from "../../../www/js/helpers.js";
import { CMD_ENTITY_INDICATORS } from "../../network/serverpackets/cmd_entity_indicators.js";

const FOLLOW_DISTANCE = 10;
const DISTANCE_LOST_TRAGET = 16;
const DISTANCE_DETONATION = 4;
const DETONATION_TIMER = 1500; //ms
const EXPLODE_DEFAULT_RAD = 2.55;

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 1/2,
            playerHeight: 1.6,
            stepHeight: 1
        });
        this.detonationTime = 0;
        this.isAggrressor = true;
        this.demage = 12;
        // Начинаем с просто "Стоять"
        this.stack.pushState(this.doStand);
    }

    isTarget() {
        if (this.isAggrressor && this.target == null) {
            let mob = this.mob;
            let connections = this.getPlayerList(mob.pos);
            let players = mob.getWorld().players;
            for (let id of connections) {
                let player = players.get(id);
                let dist = mob.pos.distance(player.state.pos);
                if (dist < FOLLOW_DISTANCE) {
                    console.log("[AI] find target and go " + id);
                    this.target = id;
                    this.stack.replaceState(this.doCatch);
                    return true;
                }
            }
        }
        return false;
    }

    runPanic() {

	}

    doStand(delta) {
        super.doStand(delta);

        if (this.isTarget()) {
            return;
        }
    }

    doForward(delta) {
        super.doForward(delta);

        if (this.isTarget()) {
            return;
        }
    }

    // Chasing a player
    async doCatch(delta) {
        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: true,
            jump: this.checkInWater()
        });

        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        const dist = mob.pos.distance(player.state.pos);

        if (dist > DISTANCE_LOST_TRAGET) {
            //console.log("[AI] mob " + this.mob.id + " lost player and stand");
            this.target = null;
            this.isStand(1.0);
            return
        }

        if (dist < DISTANCE_DETONATION) {
            this.detonationTime = performance.now();
            mob.extra_data.detonation_started = true;
            await mob.getWorld().applyActions(null, {
                play_sound: [
                    { tag: 'madcraft:block.player', action: 'fuse', pos: new Vector(mob.pos) }
                ]
            });
            this.stack.replaceState(this.doTimerDetonation);
        }

        if (Math.random() < 0.5) {
            this.mob.rotate.z = this.angleTo(player.state.pos);
        }

        this.applyControl(delta);
        this.sendState();
    }

    //
    doTimerDetonation(delta) {
        this.updateControl({
            jump: this.checkInWater(),
            forward: false
        });
        this.applyControl(delta);
        this.sendState();

        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        const dist = mob.pos.distance(player.state.pos);

        if (dist < DISTANCE_DETONATION) {
            const time = performance.now() - this.detonationTime;
            if (time > DETONATION_TIMER) {
                this.mobDetonation(EXPLODE_DEFAULT_RAD);
            }
        } else {
            mob.extra_data.detonation_started = false;
            this.stack.replaceState(this.doCatch);
        }
    }

    //
    async mobDetonation(rad) {
        //console.log("[AI] mob " + this.mob.id + " detonation");
        const mob = this.mob;
        const air = { id: 0 };
        const mobPos = mob.pos.clone().flooredSelf();
        await mob.kill();
        // Actions
        const actions = {
            blocks: {
                list: [],
                options: {
                    ignore_check_air: true,
                    on_block_set: false
                }
            },
            play_sound: []
        };
        // Extrude blocks
        const out_rad = Math.ceil(rad);
        const check_pos = mob.pos.flooredSelf().add(new Vector(.5, 0, .5));

        for (let i = -out_rad; i < out_rad; i++) {
            for (let j = -out_rad; j < out_rad; j++) {
                for (let k = -out_rad; k < out_rad; k++) {
                    const air_pos = mobPos.add(new Vector(i, k, j));
                    if (air_pos.distance(check_pos) <= rad) {
                        actions.blocks.list.push({ pos: air_pos, item: air });
                    }
                }
            }
        }
        // Kill mob
        mob.kill();
        // Add sound
        actions.play_sound.push({ tag: 'madcraft:block.creeper', action: 'explode', pos: mobPos.clone() });
        await mob.getWorld().applyActions(null, actions);
        let player = mob.getWorld().players.get(this.target);
        

        //send indicators
        player.state.indicators.live.value -= this.demage;
        new CMD_ENTITY_INDICATORS(player);
    }

}