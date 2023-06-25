import { FSMBrain } from "../brain.js";
import { WorldAction } from "@client/world_action.js";
import { EnumDamage } from "@client/enums/enum_damage.js";
import { EnumDifficulty } from "@client/enums/enum_difficulty.js";
import { MOB_TYPE } from "@client/constant.js";
import {MOB_CONTROL, MobControlParams} from "@client/control/player_control.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.stack.pushState(this.doStand);
        this.resistance_light = false; // загорается при свете
        mob.extra_data.attack = false
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
            for (const player of players) {
                const m = player.state.sneak ? 1.4 : 1.0
                if (Math.random() > (mob.pos.distance(player.state.pos) * m / this.distance_view)) {
                    this.target = player;
                    break
                }
            }
            // Если выбран режим hard, то устанавливаем общий таргет
            if (difficulty == EnumDifficulty.HARD && this.target) {
                const bots = world.getMobsNear(mob.pos, this.distance_view, MOB_TYPE.ZOMBIE);
                for (const bot of bots) {
                    const brain = bot.getBrain();
                    if (!brain.target) {
                        brain.target = this.target;
                    }
                }
            }
        }
    }

    // просто стоит на месте
    doStand(delta: float): MobControlParams | null {
        // нашел цель
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return MOB_CONTROL.STAND
        }
        if (Math.random() < 0.05) {
            this.stack.replaceState(this.doForward);
            return MOB_CONTROL.STAND
        }
        const mob = this.mob;
        mob.extra_data.attack = false
        return MOB_CONTROL.STAND
    }

    // просто ходит
    doForward(delta: float): MobControlParams | null {
        // нашел цель
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return MOB_CONTROL.NO_CHANGE
        }
        // обход препятсвия
        const mob = this.mob;
        mob.extra_data.attack = false
        if (this.is_wall || this.ahead.is_fire || this.ahead.is_lava || this.ahead.is_abyss) {
            mob.rotate.z = mob.rotate.z + (Math.PI / 2) + Math.random() * Math.PI / 2;
            this.stack.replaceState(this.doStand);
            return MOB_CONTROL.STAND
        }
        if (Math.random() < 0.05) {
            mob.rotate.z = mob.rotate.z + Math.random() * Math.PI;
            this.stack.replaceState(this.doStand);
            return MOB_CONTROL.STAND
        }
        return {
            forward: true,
            jump: false,
            sneak: false
        }
    }

    // преследование игрока
    doCatch(delta: float): MobControlParams | null {
        const mob = this.mob
        const attack = mob.config.attack
        const world = mob.getWorld();
        mob.extra_data.attack = false
        const difficulty = world.rules.getValue('difficulty');
        if (!this.target || difficulty == EnumDifficulty.PEACEFUL) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return MOB_CONTROL.STAND
        }
        const dist = mob.pos.distance(this.target.state.pos);
        if (mob.playerCanBeAtacked(this.target) || dist > this.distance_view) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return MOB_CONTROL.STAND
        }
        if (dist < attack.distance) {
            this.stack.replaceState(this.doAttack);
            return MOB_CONTROL.NO_CHANGE
        }
        mob.rotate.z = this.angleTo(this.target.state.pos);
        return {
            forward: true, //!(this.is_abyss | this.is_well),
            jump: this.in_water
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
                case 2: items.push({ id: type_damage != EnumDamage.FIRE ? bm.POTATOES.id : bm.BACKED_POTATO.id, count: 1 }); break;
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