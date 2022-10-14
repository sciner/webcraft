import { FSMBrain } from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { WorldAction } from "../../../www/js/world_action.js";
import { EnumDamage } from "../../../www/js/enums/enum_damage.js";
import { EnumDifficulty } from "../../../www/js/enums/enum_difficulty.js";
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../../www/js/fluid/FluidConst.js";

const ATTACK_DISTANCE = 1.5;
const VIEW_DISTANCE = 40;
const MUL_1_SEC = 20;

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos = new Vector(mob.pos);
        this.lerpPos = new Vector(mob.pos);
        this.pc = this.createPlayerControl(this, {
            baseSpeed: 0.8,
            playerHeight: 1.6,
            playerHalfWidth: 0.45,
            stepHeight: 1
        });

        this.timer_attack = 0;
        this.interval_attack = 16;
        this.stack.pushState(this.doStand);
        
        // инфо
        this.health = 20;
        
        // таймеры
        this.timer_health = 0;
        this.timer_fire_damage = 0;
        this.timer_lava_damage = 0;
        this.timer_water_damage = 0;
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
         // Урон от сложности игры
        const difficulty = mob.getWorld().getGameRule('difficulty'); 
        const ahead = chunk.getBlock(mob.pos.add(new Vector(Math.sin(mob.rotate.z), this.pc.playerHeight + 1, Math.cos(mob.rotate.z))).floored());
        const head = chunk.getBlock(mob.pos.add(new Vector(0, this.pc.playerHeight + 1, 0)).floored());
        const legs = chunk.getBlock(mob.pos.floored());
        const under = chunk.getBlock(mob.pos.add(new Vector(Math.sin(mob.rotate.z), -1, Math.cos(mob.rotate.z))).floored());
        const abyss = chunk.getBlock(mob.pos.add(new Vector(Math.sin(mob.rotate.z), -2, Math.cos(mob.rotate.z))).floored());
        this.in_water = head && head.id == 0 && (head.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID;
        this.in_fire = (legs && legs.id == BLOCK.FIRE.id);
        this.in_lava = (legs && legs.id == 0 && (legs.fluid & FLUID_TYPE_MASK) === FLUID_LAVA_ID);
        this.is_wall = ahead.id != 0 && ahead.id != -1 && ahead.material.style != 'planting';
        this.is_abyss = under.id == 0 && abyss.id == 0;

        if (this.in_lava) {
            if (this.timer_lava_damage-- <= 0) {
                this.timer_lava_damage = MUL_1_SEC; 
                this.onDamage(null, 2, EnumDamage.LAVA);
            }
            this.time_fire = Math.max(10 * MUL_1_SEC, this.time_fire); 
        }
        
        if (this.in_fire || world.getLight() > 11) {
            this.time_fire = Math.max(8 * MUL_1_SEC, this.time_fire);
        }
        // горение 
        if (this.time_fire-- >= 0 && !this.in_water) {
            if (this.timer_fire_damage-- <= 0) {
                this.timer_fire_damage = MUL_1_SEC; 
                this.onDamage(null, 1, EnumDamage.FIRE);
            }
        }

        // update extra data
        this.mob.extra_data.time_fire = this.time_fire;

        // нехватка воздуха
        if (this.in_water) {
            if (this.timer_water_damage-- <= 0) {
                this.onDamage(null, 50, EnumDamage.WATER);
            }
        } else {
            this.timer_water_damage = 30 * MUL_1_SEC; 
        }
        // регенерация жизни
        if (this.timer_health-- <= 0) {
            const live = mob.indicators.live;
            live.value = Math.min(live.value + 1, this.health);
            this.timer_health = 10 * MUL_1_SEC;
        }
        // поиск жертвы
        if (this.target == null && difficulty != EnumDifficulty.PEACEFUL) {
            const players = this.getPlayersNear(mob.pos, VIEW_DISTANCE, true);
            if (players.length > 0) {
                const rnd = (Math.random() * players.length) | 0;
                const player = players[rnd];
                this.target = player;
                // Если выбран режим hard, то устанавливаем общий таргет
                if (difficulty == EnumDifficulty.HARD) {
                    const bots = world.getMobsNear(mob.pos, VIEW_DISTANCE, 'zombie');
                    for (const bot of bots) {
                        const brain = bot.getBrain();
                        if (!brain.target) {
                            brain.target = player;
                        }
                    }
                }
            }
        }
    }
    
    // простое движение
    doForward(delta) {
        this.onUpdate(delta);
        const mob = this.mob;
        // нашел цель
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return;
        }
        // уперся в стену, поворот
        if (this.is_wall || this.is_abyss) {
            mob.rotate.z = mob.rotate.z + (Math.PI / 2) + Math.random() * Math.PI / 2;
            this.stack.replaceState(this.doStand);
            return;
        }
        this.updateControl({
            yaw: mob.rotate.z,
            forward: true
        });
        this.applyControl(delta);
        this.sendState();
        if (Math.random() < 0.05) {
            mob.rotate.z = mob.rotate.z + (Math.PI / 2) + Math.random() * Math.PI / 2;
            this.stack.replaceState(this.doStand);
        }
    }
    
    // просто стоит
    doStand(delta) {
        this.onUpdate(delta);
        const mob = this.mob;
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return;
        }
        this.updateControl({
            yaw: mob.rotate.z,
            forward: false
        });
        this.applyControl(delta);
        this.sendState();
        if (Math.random() < 0.05) {
            this.stack.replaceState(this.doForward);
        }
    }
    
    doAttack(delta) {
        this.onUpdate(delta);
        const mob = this.mob;
        if (!this.target) {
            this.stack.replaceState(this.doStand);
            return;
        }
        // Урон от сложности игры
        const difficulty = mob.getWorld().getGameRule('difficulty'); 
        const dist = mob.pos.distance(this.target.state.pos);
        if (mob.playerCanBeAtacked(this.target) || dist > ATTACK_DISTANCE) {
            this.stack.replaceState(this.doCatch);
            return;
        }
        const angle_to_player = this.angleTo(this.target.state.pos);
        // моб должен примерно быть направлен на игрока
        if (Math.abs(mob.rotate.z - angle_to_player) > Math.PI / 2) {
            // сперва нужно к нему повернуться
            this.mob.rotate.z = angle_to_player;
            this.sendState();
        } else {
            if (this.timer_attack++ >= this.interval_attack) {
                this.timer_attack = 0;
                switch(difficulty) {
                    case EnumDifficulty.EASY: this.target.setDamage(Math.random() < 0.5 ? 2 : 3); break;
                    case EnumDifficulty.NORMAL: this.target.setDamage(3); break;
                    case EnumDifficulty.HARD: this.target.setDamage(Math.random() < 0.5 ? 4 : 5); break;
                }
            }
        }
    }
    
    // Chasing a player
    doCatch(delta) {
        this.onUpdate(delta);
        const mob = this.mob;
        if (!this.target) {
            this.stack.replaceState(this.doStand);
            return;
        }
        const dist = mob.pos.distance(this.target.state.pos);
        if (mob.playerCanBeAtacked(this.target) || dist > VIEW_DISTANCE) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return;
        }
        if (dist < ATTACK_DISTANCE) {
            this.stack.replaceState(this.doAttack);
            return;
        }
        mob.rotate.z = this.angleTo(this.target.state.pos);
        this.updateControl({
            yaw: mob.rotate.z,
            forward: !(this.is_abyss | this.is_well)
        });
        this.applyControl(delta);
        this.sendState();
    }
    
    // Если убили моба
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
    
    onPanic() {
        
    }
}