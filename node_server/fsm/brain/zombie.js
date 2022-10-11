import { FSMBrain } from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { WorldAction } from "../../../www/js/world_action.js";
import { ServerClient } from "../../../www/js/server_client.js";
import { Damage } from "../../../www/js/block_type/damage.js";

const FOLLOW_DISTANCE = 20;
const DISTANCE_LOST_TRAGET = 25;
const FIRE_LOST_TICKS = 10;

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos = new Vector(mob.pos);
        this.lerpPos = new Vector(mob.pos);
        this.pc = this.createPlayerControl(this, {
            baseSpeed: 1 / 2,
            playerHeight: 1.6,
            stepHeight: 1
        });

        this.width = 0.6;
        this.height = 1.95;

        this.follow_distance = 20;
        this.distance_attack = 1.5;
        this.timer_attack = 0;
        this.interval_attack = 16;
        this.stack.pushState(this.doStand);
        
        this.timer_fire_damage = 0;
        this.in_fire = false;
    }
    
    // Метод для возобновления жизни, урона и т.д.
    doUpdate(delta) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (world.getLight() > 6) {
            this.in_fire = true;
        }
        if (this.in_fire) {
            if (this.timer_fire_damage++ > FIRE_LOST_TICKS) {
                this.in_fire = false;
                this.timer_fire_damage = 0;
                this.onDamage(null, 2, Damage.FIRE);
            }
        }
    }

    findTarget() {
        if (this.target == null) {
            const mob = this.mob;
            const players = this.getPlayersNear(mob.pos, this.follow_distance, true);
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
        this.doUpdate(delta);
        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        const world = mob.getWorld();
        const difficulty = world.getGameRule('difficulty'); // Урон от сложности игры
        const dist = mob.pos.distance(player.state.pos);
        if (mob.playerCanBeAtacked(player) || dist > this.distance_attack) {
            this.stack.replaceState(this.doCatch);
            return;
        }
        const angle_to_player = this.angleTo(player.state.pos);
        // моб должен примерно быть направлен на игрока
        if (Math.abs(mob.rotate.z - angle_to_player) > Math.PI / 2) {
            // сперва нужно к нему повернуться
            this.mob.rotate.z = angle_to_player;
            this.sendState();
        } else {
            this.timer_attack++;
            if (this.timer_attack >= this.interval_attack) {
                this.timer_attack = 0;
                switch(difficulty) {
                    case 0: {
                        player.setDamage(Math.random() < 0.5 ? 2 : 3);
                        break;
                    }
                    case 1: {
                        player.setDamage(3);
                        break;
                    }
                    case 3: {
                        player.setDamage(Math.random() < 0.5 ? 4 : 5);
                        break;
                    }
                }
            }
        }
    }

    // Chasing a player
    async doCatch(delta) {
        this.doUpdate(delta);
        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        const dist = mob.pos.distance(player.state.pos);
        if (mob.playerCanBeAtacked(player) || dist > DISTANCE_LOST_TRAGET) {
            this.lostTarget();
            return;
        }

        mob.rotate.z = this.angleTo(player.state.pos);

        const block = this.getBeforeBlocks();
        const is_water = block.body.is_fluid;
        this.updateControl({
            yaw: mob.rotate.z,
            forward: true,
            jump: is_water
        });
        this.applyControl(delta);
        this.sendState();

        if (dist < this.distance_attack) {
            this.stack.replaceState(this.doAttack);
		}
    }

    lostTarget() {
        const mob = this.mob;
        this.target = null;
        this.stack.replaceState(this.doStand);
    }

    onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        const items = [];
        const actions = new WorldAction();
        const rnd_count_flesh = (Math.random() * 2) | 0;
        if (rnd_count_flesh > 0) {
            items.push({ id: BLOCK.ROTTEN_FLESH.id, count: rnd_count_flesh });
        }
        if (Math.random() < 0.025) {
            
            items.push({ id: BLOCK.ROTTEN_FLESH.id, count: rnd_count_flesh });
        }
        if (items.length > 0) {
            actions.addDropItem({ pos: mob.pos, items: items, force: true });
        }
        actions.addPlaySound({ tag: 'madcraft:block.zombie', action: 'death', pos: mob.pos.clone() });
        world.actions_queue.add(actor, actions);
    }
    
    onDamage(actor, val, type_damage) {
        const mob = this.mob;
        const live = mob.indicators.live;
        const pos_actor = (actor && actor.session) ? actor.state.pos : new Vector(0, 0, 0);
        const velocity = mob.pos.sub(pos_actor).normSelf();
        velocity.y = 0.3;
        mob.addVelocity(velocity);
        live.value -= val;
        if (live.value < 1) {
            this.onKill(actor, type_damage);
        }
    }
}