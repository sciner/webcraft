import { FSMBrain } from "../brain.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { EnumDamage } from "@client/enums/enum_damage.js";
import { EnumDifficulty } from "@client/enums/enum_difficulty.js";

export class Brain extends FSMBrain {
    distance_attack: number;
    timer_attack: number;
    interval_attack: number;

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
        this.stack.pushState(this.doStand);
        this.health = 20;       // максимальное здоровье
        this.distance_view = 40; // дистанция на которм виден игрок
        this.distance_attack = 1.5; // дистанция для атаки
        this.timer_attack = 0;
        this.interval_attack = 16;
        this.resistance_light = false; // загорается при свете
    }
    
    onLive() {
        super.onLive();
    }
    
    // поиск игрока для атаки
    onFind() {
        if (this.target || this.distance_view < 1) {
            return;
        }
        const mob = this.mob;
        const world = mob.getWorld();
        const difficulty = world.rules.getValue('difficulty'); 
        const players = world.getPlayersNear(mob.pos, this.distance_view, true);
        if (players.length > 0 && difficulty != EnumDifficulty.PEACEFUL) {
            const rnd = (Math.random() * players.length) | 0;
            const player = players[rnd];
            this.target = player;
            // Если выбран режим hard, то устанавливаем общий таргет
            if (difficulty == EnumDifficulty.HARD) {
                const bots = world.getMobsNear(mob.pos, this.distance_view, 'zombie');
                for (const bot of bots) {
                    const brain = bot.getBrain();
                    if (!brain.target) {
                        brain.target = player;
                    }
                }
            }
        }
    }
    
    // просто стоит на месте
    doStand(delta) {
        // нашел цель
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return;
        }
        if (Math.random() < 0.05) {
            this.stack.replaceState(this.doForward);
            return;
        }
        const mob = this.mob;
        this.updateControl({
            yaw: mob.rotate.z,
            forward: false,
            jump: false,
            sneak: false
        });
        this.applyControl(delta);
        this.sendState();
    }
    
    // просто ходит
    doForward(delta) {
        // нашел цель
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return;
        }
        // обход препятсвия
        const mob = this.mob;
        if (this.is_wall || this.is_fire || this.is_lava) {
            mob.rotate.z = mob.rotate.z + (Math.PI / 2) + Math.random() * Math.PI / 2;
            this.stack.replaceState(this.doStand);
            return;
        }
        if (Math.random() < 0.05) {
            mob.rotate.z = mob.rotate.z + Math.random() * Math.PI;
            this.stack.replaceState(this.doStand);
            return;
        }
        this.updateControl({
            yaw: mob.rotate.z,
            forward: true,
            jump: false,
            sneak: false
        });
        this.applyControl(delta);
        this.sendState();
    }
    
    // преследование игрока
    doCatch(delta) {
        const mob = this.mob;
        const world = mob.getWorld();
        const difficulty = world.rules.getValue('difficulty');
        if (!this.target || difficulty == EnumDifficulty.PEACEFUL) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return;
        }
        const dist = mob.pos.distance(this.target.state.pos);
        if (mob.playerCanBeAtacked(this.target) || dist > this.distance_view) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return;
        }
        if (dist < this.distance_attack) {
            this.stack.replaceState(this.doAttack);
            return;
        }
        mob.rotate.z = this.angleTo(this.target.state.pos);
        this.updateControl({
            yaw: mob.rotate.z,
            forward: true, //!(this.is_abyss | this.is_well),
            jump: this.is_water
        });
        this.applyControl(delta);
        this.sendState();
    }
    
    doAttack(delta) {
        const mob = this.mob;
        const world = mob.getWorld();
        const difficulty = world.rules.getValue('difficulty');
        if (!this.target || difficulty == EnumDifficulty.PEACEFUL) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return;
        }
        const dist = mob.pos.distance(this.target.state.pos);
        if (mob.playerCanBeAtacked(this.target) || dist > this.distance_attack || this.is_gate) {
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
    
    // Если убили моба
    onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        const items = [];
        const actions = new WorldAction();
        const rnd_count_flesh = (Math.random() * 2) | 0;
        const bm = world.block_manager
        if (rnd_count_flesh > 0) {
            items.push({ id: bm.ROTTEN_FLESH.id, count: rnd_count_flesh });
        }
        if (Math.random() < 0.025) {
            const drop = (Math.random() * 2) | 0;
            switch (drop) {
                case 0: items.push({ id: bm.IRON_INGOT.id, count: 1 }); break;
                case 1: items.push({ id: bm.CARROT.id, count: 1 }); break;
                case 2: items.push({ id: type_damage != EnumDamage.FIRE ? bm.POTATO.id : bm.BACKED_POTATO.id, count: 1 }); break;
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
    
    onUse(actor: any, item : any) : boolean {
        super.onUse(actor, item)
        this.mob.extra_data.armor = {
            head: 279, 
            body: 275,
            leg: null,
            boot: null,
        };
        return false
    }

}