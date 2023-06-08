import { FSMBrain } from "../brain.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { BeeNest } from "../../block_type/bee_nest.js";
import { EnumDifficulty } from "@client/enums/enum_difficulty.js";
import type { EnumDamage } from "@client/enums/enum_damage.js";
import { DEFAULT_STYLE_NAME, MOB_TYPE } from "@client/constant.js";
import {MobControlParams, MOB_CONTROL} from "@client/control/player_control.js";

const MAX_POLLEN = 4;
const POLLEN_PER_TICK = 0.02;

export class Brain extends FSMBrain {
    ticks_pollination: number;
    ticks_anger: number;
    follow_distance: number;
    back_distance: number;
    anger_time: number;
    live: number;
    fly: number;

    constructor(mob) {
        super(mob);
        //
        this.pc.player_state.flying = true;// @todo костыль от сброса полета при касании земли

        this.ticks_pollination = 0;
        this.ticks_anger = 0;

        //consts
        this.follow_distance = 10;
        this.back_distance = 10;
        this.anger_time = 300;
        this.live = 10;
        this.fly = 0;

        this.stack.pushState(this.doForward);

    }

    // поиск блоков под пчелой для полета и анализа есть ли там цветок
    getFlightBlocks(ignore_nest) {

        // @todo костыль от сброса полета при касании земли
        this.pc.player_state.flying = true;
        const mob = this.mob;
        const world = mob.getWorld();

        const pos_body = new Vector(Math.sin(mob.rotate.z), 0, Math.cos(mob.rotate.z)).addSelf(mob.pos).flooredSelf();
        const pos_legs = mob.pos.sub(Vector.YP).flooredSelf();
        const body = world.getBlock(pos_body);
        const legs = world.getBlock(pos_legs);

        // if on plant
        if (legs && legs.id != 0 && legs.material.style == DEFAULT_STYLE_NAME) {
            if(ignore_nest || (legs && legs.hasTag && !legs.hasTag('bee_nest'))) {
                this.fly = Math.random() * 20 | 0;
            }
        }

        let jump = false;
        let sneak = false;
        if (this.fly > 0) {
            this.fly--;
            jump = true;
            sneak = false;
        } else {
            jump = false;
            sneak = true;
        }

        return { body, legs, jump, sneak };
    }

    // возвращение в улей
    doReturnToHome(delta): MobControlParams | null {
        const mob = this.mob;
        const block = this.getFlightBlocks(false);

        if (Math.random() < 0.02) {
            mob.rotate.z = this.angleTo(mob.pos_spawn);
        } else if (Math.random() < 0.02) {
           mob.rotate.z = Math.round(((mob.rotate.z + Math.random() * Math.PI / 4) % 6.28) * 1000) / 1000;
        }

        this.applyControl(delta, {
            jump: block.jump,
            forward: true,
            sneak: block.sneak
        })
        this.sendState();

        // check if near nest
        const spawn_distance = mob.pos.distance(mob.pos_spawn);
        if(spawn_distance < 1) {
            const world = mob.getWorld();
            const tblock = world.getBlock(mob.pos_spawn.floored());
            if(tblock && tblock.hasTag('bee_nest')) {
                // console.log('found BeeNest');
                const nest = new BeeNest(tblock);
                nest.appendMob(mob);
            }
        }
        return null // уже выполнили физику выше
    }

    // сбор пыльцы
    doPollen(delta: float): MobControlParams | null {
        const mob = this.mob;
        /* этот код был раньше (лететь вниз), но физика не вызывалась. Похоже, надо не лететь вниз (без sneak)
        this.updateControl({
            jump: false,
            forward: false,
            sneak: true
        });
        */
        if (mob.extra_data.pollen >= MAX_POLLEN) {
            mob.extra_data.pollen = MAX_POLLEN;
            // console.log("[AI] doReturnToHome");
            this.ticks_pollination = 0;
            this.stack.replaceState(this.doReturnToHome);
        } else {
            mob.extra_data.pollen += POLLEN_PER_TICK;
        }
        return MOB_CONTROL.STAND // висеть в воздухе
    }

    // просто полет
    doForward(delta: float): MobControlParams | null {
        const mob = this.mob;

        const block = this.getFlightBlocks(true);

        if (Math.random() < 0.02) {
           mob.rotate.z = Math.round(((mob.rotate.z + Math.random() * Math.PI / 4) % 6.28) * 1000) / 1000;
        }

        const hive_distance = mob.pos.distance(mob.pos_spawn);
        if (hive_distance > this.back_distance) {
            mob.rotate.z = this.angleTo(mob.pos_spawn);
        }

        this.applyControl(delta, {
            jump: block.jump,
            forward: true,
            sneak: block.sneak
        });
        this.sendState();

        // если на уровне ног есть цветок
        if (block.legs && block.legs.hasTag && block.legs.hasTag('flower')) {
            if(mob.extra_data.pollen < MAX_POLLEN && this.ticks_pollination > 300) {
                // console.log("[AI] doPollen");
                this.stack.replaceState(this.doPollen);
            }
        }

        // если наступил вечер или набрали пыльцы, то меняем состояние на "лететь в улей"
        const world = mob.getWorld();
        const time = world.info.calendar.day_time;
        if (time < 6000 || time > 18000 || mob.extra_data.pollen >= MAX_POLLEN) {
            // console.log("[AI] doReturnToHome");
            this.stack.replaceState(this.doReturnToHome);
        }

        this.ticks_pollination++;

        // теряет немного пыльцы в полёте
        mob.extra_data.pollen -= POLLEN_PER_TICK / 10;
        mob.extra_data.pollen = Math.max(mob.extra_data.pollen, 0);

        return null // уже выполнили физику выше
    }

    // преследование игрока
    doFollow(delta: float): MobControlParams | null {
        const mob = this.mob;

        if (!this.target) {
            this.stack.replaceState(this.doForward);
            return null
        }

        const player = this.target;
        const world = mob.getWorld();
        const difficulty = world.rules.getValue('difficulty');
        if (!player || mob.playerCanBeAtacked(player) || difficulty == EnumDifficulty.PEACEFUL) {
            this.target = null;
            this.stack.replaceState(this.doForward);
            return null
        }

        const distance = mob.pos.horizontalDistance(player.state.pos);
        if (distance > this.follow_distance) {
            this.target = null;
            this.stack.replaceState(this.doForward);
            return null
        }

        mob.rotate.z = this.angleTo(player.state.pos);

        if (this.ticks_anger <= this.anger_time) {
            const attack = mob.config.attack
            if (Math.abs(player.state.pos.y + 2 - mob.pos.y) < 0.5 && this.timer_attack > attack.interval && distance < attack.distance) {
                this.attack(difficulty)
            }
            this.timer_attack++;
            this.ticks_anger++;
            if (this.ticks_anger == this.anger_time) {
                this.target = null;
                this.stack.replaceState(this.doForward);
                return null
            }
        }

        this.ticks_pollination++;
        mob.extra_data.pollen -= POLLEN_PER_TICK / 10;

        const block = this.getFlightBlocks(true);
        return {
            jump: block.jump,
            forward: distance > 1.5,
            sneak: block.sneak
        }
    }

    onDamage(val : number, type_damage : EnumDamage, actor) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (actor) {
            const velocity = mob.pos.sub(actor.state.pos).normSelf();
            velocity.y = 0.4;
            mob.addVelocity(velocity);
            const bots = world.getMobsNear(mob.pos, this.back_distance);
            for (const bot of bots) {
                if (bot.type == MOB_TYPE.BEE) {
                    bot.getBrain().setCommonTarget(actor);
                }
            }
            this.setCommonTarget(actor);
        }
        mob.indicators.live -= val;
        if (mob.indicators.live <= 0) {
            mob.kill();
            this.onKill(actor, type_damage);
        } else {
            const actions = new WorldAction();
            const mob_type = mob.skin.model_name.split('/')[1]
            actions.addPlaySound({ tag: 'madcraft:block.' + mob_type, action: 'hurt', pos: mob.pos.clone() });
            world.actions_queue.add(actor, actions);
            mob.markDirty();
        }
    }

    // установка общего таргета для атаки (атака роем)
    setCommonTarget(actor) {
        this.target = actor;
        this.ticks_anger = 0;
        this.stack.replaceState(this.doFollow);
    }

}