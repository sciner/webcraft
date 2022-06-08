import { FSMBrain } from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { PickatActions } from "../../../www/js/block_action.js";
import {ServerClient} from "../../../www/js/server_client.js";

const FOLLOW_DISTANCE       = 20;
const DISTANCE_LOST_TRAGET  = 25;

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
        this.distance_attack = 1.5;
        this.timer_attack = 0;
        this.interval_attack = 16;
        this.stack.pushState(this.doStand);
    }

    findTarget() {
        if (this.target == null) {
            const mob = this.mob;
            const players = this.getPlayersNear(mob.pos, FOLLOW_DISTANCE, true);
            if (players.length > 0) {
                const rnd = (Math.random() * players.length) | 0;
                const player = players[rnd];
                this.target = player.session.user_id;
                this.stack.replaceState(this.doCatch);
                return true;
            }
        }
        return false;
    }

    onPanic() {

    }

    lostTarget() {
        this.target = null;
        this.stack.replaceState(this.doStand);
        this.sendState();
    }

    doAttack(delta) {
        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);

        // если игрока нет, он умер или сменил игровой режим на безопасный, то теряем к нему интерес
        if(!mob.playerCanBeAtacked(player)) {
            return this.lostTarget();
        }

        const world = mob.getWorld();
        const dist = mob.pos.distance(player.state.pos);
        if (dist > this.distance_attack) {
            return this.stack.replaceState(this.doCatch);
        }
        this.timer_attack++;
        const angle_to_player = this.angleTo(player.state.pos);
        // моб должен примерно быть направлен на игрока
        if(Math.abs(this.mob.rotate.z - angle_to_player) > Math.PI / 2) {
            // сперва нужно к нему повернуться
            this.mob.rotate.z = angle_to_player;
            this.sendState();
        } else {
            if (this.timer_attack >= this.interval_attack) {
                this.timer_attack = 0;
                player.changeLive(-2);
                const actions = new PickatActions();
                actions.addPlaySound({ tag: 'madcraft:block.player', action: 'hit', pos: player.state.pos.clone() }); // Звук получения урона
                world.actions_queue.add(player, actions);
            }
        }
	}
    
    // Chasing a player
    async doCatch(delta) {
        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        if(!player || !player.game_mode.getCurrent().can_take_damage) {
            return this.lostTarget();
        }

        //
        const dist = mob.pos.distance(player.state.pos);
        if (dist > DISTANCE_LOST_TRAGET) {
            return this.lostTarget();
        }

        this.mob.rotate.z = this.angleTo(player.state.pos);

        if (dist < this.distance_attack) {
            this.stack.replaceState(this.doAttack);
		}

        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: true,
            jump: this.checkInWater()
        });

        this.applyControl(delta);
        this.sendState();
    }

    lostTarget() {
        // console.log("[AI] mob " + this.mob.id + " lost player and stand");
        const mob = this.mob;
        mob.extra_data.detonation_started = false;
        this.target = null;
        this.isStand(1.0);
        this.sendState();
    }
    
    onKill(actor, type_demage) {
        const mob = this.mob;
        const world = mob.getWorld();
        let items = [];
        let velocity = new Vector(0,0,0);
        if (actor != null) {
            //actor это игрок
            if (actor.session) {
                velocity = actor.state.pos.sub(mob.pos).normal().multiplyScalar(.5);
                const rnd_count = (Math.random() * 2) | 0;
                if (rnd_count > 0){ 
                    items.push({id: 1445, count: rnd_count});
                }
                
            }
        }
        if (items.length > 0){
            world.createDropItems(actor, mob.pos.add(new Vector(0, 0.5, 0)), items, velocity);
        }
    }
}