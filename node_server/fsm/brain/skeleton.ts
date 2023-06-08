import { FSMBrain } from "../brain.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { EnumDifficulty } from "@client/enums/enum_difficulty.js";

// @todo Недоработанный мозг скелета, надо будет всё поправить (убираем фикс размера, пока нет лука)
export class Brain extends FSMBrain {
    distance_attack: number;
    timer_attack: number;
    interval_attack: number;

    constructor(mob) {
        super(mob);
        //
        this.stack.pushState(this.doStand);
        this.distance_attack = 1.5; // дистанция для атаки
        this.timer_attack = 0;
        this.interval_attack = 16;
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
        }
    }

    // просто стоит на месте
    doStand(delta: float): boolean {
        // нашел цель
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return false
        }
        if (Math.random() < 0.05) {
            this.stack.replaceState(this.doForward);
            return false
        }
        const mob = this.mob;
        mob.extra_data.attack = false
        this.updateControl({
            forward: false,
            jump: false,
            sneak: false
        });
        return true
    }

    // просто ходит
    doForward(delta: float): boolean {
        // нашел цель
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return false
        }
        // обход препятсвия
        const mob = this.mob;
        mob.extra_data.attack = false
        if (this.is_wall || this.ahead.is_fire || this.ahead.is_lava || this.ahead.is_abyss) {
            mob.rotate.z = mob.rotate.z + (Math.PI / 2) + Math.random() * Math.PI / 2;
            this.stack.replaceState(this.doStand);
            return false
        }
        if (Math.random() < 0.05) {
            mob.rotate.z = mob.rotate.z + Math.random() * Math.PI;
            this.stack.replaceState(this.doStand);
            return false
        }
        this.updateControl({
            forward: true,
            jump: false,
            sneak: false
        });
        return true
    }

    // преследование игрока
    doCatch(delta: float): boolean {
        const mob = this.mob;
        const world = mob.getWorld();
        mob.extra_data.attack = false
        const difficulty = world.rules.getValue('difficulty');
        if (!this.target || difficulty == EnumDifficulty.PEACEFUL) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return false
        }
        const dist = mob.pos.distance(this.target.state.pos);
        if (mob.playerCanBeAtacked(this.target) || dist > this.distance_view) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return false
        }
        if (dist < this.distance_attack) {
            this.stack.replaceState(this.doAttack);
            return false
        }
        mob.rotate.z = this.angleTo(this.target.state.pos);
        this.updateControl({
            forward: true, //!(this.is_abyss | this.is_well),
            jump: this.ahead.is_water
        });
        return true
    }

    doAttack(delta: float): boolean {
        const mob = this.mob;
        const world = mob.getWorld();
        const difficulty = world.rules.getValue('difficulty');
        if (!this.target || difficulty == EnumDifficulty.PEACEFUL) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return false
        }
        const dist = mob.pos.distance(this.target.state.pos);
        if (mob.playerCanBeAtacked(this.target) || dist > this.distance_attack || this.is_wall) {
            this.stack.replaceState(this.doCatch);
            return false
        }
        const angle_to_player = this.angleTo(this.target.state.pos);
        // моб должен примерно быть направлен на игрока
        if (Math.abs(mob.rotate.z - angle_to_player) > Math.PI / 2) {
            // сперва нужно к нему повернуться
            this.mob.rotate.z = angle_to_player;
            this.sendState();
        } else {
            if (this.timer_attack++ >= this.interval_attack) {
                mob.extra_data.attack = true
                this.timer_attack = 0;
                switch(difficulty) {
                    case EnumDifficulty.EASY: this.target.setDamage(2); break;
                    case EnumDifficulty.NORMAL: this.target.setDamage(Math.random() < 0.5 ? 2 : 3); break;
                    case EnumDifficulty.HARD: this.target.setDamage(3); break;
                }
                this.sendState()
            }
        }
        return false
    }

    // Если убили моба
    onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        const items = [];
        const actions = new WorldAction();
        const rnd_count_bone = (Math.random() * 2) | 0;
        const bm = world.block_manager
        if (rnd_count_bone > 0) {
            items.push({ id: bm.BONE.id, count: rnd_count_bone });
        }

        if (items.length > 0) {
            actions.addDropItem({ pos: mob.pos, items: items, force: true });
        }
        actions.addPlaySound({ tag: 'madcraft:block.skeleton', action: 'death', pos: mob.pos.clone() });
        world.actions_queue.add(actor, actions);
    }

    onPanic() {

    }


}