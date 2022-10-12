import { FSMBrain } from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { WorldAction } from "../../../www/js/world_action.js";
import { ServerClient } from "../../../www/js/server_client.js";
import { EnumDamage } from "../../../www/js/enums/enum_damage.js";
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../../www/js/fluid/FluidConst.js";

const FOLLOW_DISTANCE = 20;
const DISTANCE_LOST_TRAGET = 25;
const FIRE_LOST_TICKS = 10;
const MUL_1_SEC = 20;

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
        
        // инфо
        this.health = 20;
        
        // таймеры
        this.timer_health = 0;
        this.timer_fire_damage = 0;
        this.timer_lava_damage = 0;
        this.time_fire = 0;
        
        // где находится моб
        this.in_fire = false;
        this.in_water = false;
        this.in_lava = false;
    }
    
    // Метод для возобновления жизни, урона и т.д.
    onUpdate(delta) {
        const mob = this.mob;
        const world = mob.getWorld();
        const chunk = world.chunks.get(mob.chunk_addr);
        if (!chunk) {
            return;
        }
        
        const head = chunk.getBlock(mob.pos.add(new Vector(0, this.height + 1, 0)).floored());
        const legs = chunk.getBlock(mob.pos.add(new Vector(0, 0, 0)).floored());
        this.in_water = head && head.id == 0 && (head.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID;
        this.in_fire = ((legs && legs.id == BLOCK.FIRE.id) || world.getLight() > 11);
        this.in_lava = (legs && legs.id == 0 && (legs.fluid & FLUID_TYPE_MASK) === FLUID_LAVA_ID);
        
        if (this.in_lava) {
            if (this.timer_lava_damage-- <= 0) {
                this.timer_lava_damage = MUL_1_SEC; 
                this.onDamage(null, 2, EnumDamage.LAVA);
            }
            this.time_fire = Math.max(10 * MUL_1_SEC, this.time_fire); 
        }
        
        if (this.in_fire) {
            this.time_fire = Math.max(8 * MUL_1_SEC, this.time_fire); 
        }
        //console.log('in_lava: ' + this.in_lava + ' in_fire:' + this.in_fire);
        
        // урон от горения
        if (this.timer_fire_damage++ > this.time_fire) {
            if (this.timer_fire_damage % MUL_1_SEC == 0) {
                this.onDamage(null, 1, EnumDamage.FIRE);
            }
            this.timer_fire_damage = 0;
            this.time_fire = 0;
        }
        // регенерация жизни
        if (this.timer_health-- <= 0) {
            const live = mob.indicators.live;
            live.value = Math.min(live.value + 1, this.health);
            this.timer_health = 10 * MUL_1_SEC;
        }
        
        // Приоритеты действий
        if (this.in_water) {
            //return;
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
        this.onUpdate(delta);
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
            if (this.timer_attack++ >= this.interval_attack) {
                this.timer_attack = 0;
                switch(difficulty) {
                    case 1: player.setDamage(Math.random() < 0.5 ? 2 : 3); break;
                    case 2: player.setDamage(3); break;
                    case 3: player.setDamage(Math.random() < 0.5 ? 4 : 5); break;
                }
            }
        }
    }

    // Chasing a player
    async doCatch(delta) {
        this.onUpdate(delta);
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
            const drop = (Math.random() * 2) | 0;
            switch (drop) {
                case 0: items.push({ id: BLOCK.IRON_INGOT.id, count: 1 }); break;
                case 1: items.push({ id: BLOCK.CARROT.id, count: 1 }); break;
                case 2: items.push({ id: type_damage != Damage.FIRE ? BLOCK.POTATO.id : BLOCK.BACKED_POTATO.id, count: 1 }); break;
            }
        }
        if (items.length > 0) {
            actions.addDropItem({ pos: mob.pos, items: items, force: true });
        }
        actions.addPlaySound({ tag: 'madcraft:block.zombie', action: 'death', pos: mob.pos.clone() });
        world.actions_queue.add(actor, actions);
    }
    
    onDamage(actor, val, type_damage) {
        console.log('damage: ' + val + ' source: ' + type_damage)
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