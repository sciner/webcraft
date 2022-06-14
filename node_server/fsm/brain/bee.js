import { FSMBrain } from "../brain.js";
import { Vector } from "../../../www/js/helpers.js";
import { PickatActions } from "../../../www/js/block_action.js";
import { BeeNest } from "../../../www/js/block_type/bee_nest.js";

const MAX_POLLEN = 4;
const POLLEN_PER_TICK = 0.02;

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this,{
            baseSpeed: 0.25,
            playerHeight: 0.6,
            stepHeight: 1,
            playerHalfWidth: 0.3,
        });
        
        this.pc.player_state.flying = true;// @todo костыль от сброса полета при касании земли
        
        this.ticks_pollination = 0;
        this.ticks_anger = 0;
        this.ticks_attack = 0;
        
        //consts
        this.distance_attack = 1.5;
        this.interval_attack = 16;
        this.follow_distance = 10;
        this.back_distance = 10;
        this.anger_time = 300;
        this.damage = 2;
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
        if (legs && legs.id != 0 && legs.material.style == 'default') {
            if(ignore_nest || !legs.hasTag('bee_nest')) {
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
    async doReturnToHome(delta) {
        const mob = this.mob;
        const block = this.getFlightBlocks(false);
        
        if (Math.random() < 0.02) {
            mob.rotate.z = this.angleTo(mob.pos_spawn);
        } else if (Math.random() < 0.02) {
           mob.rotate.z = Math.round(((mob.rotate.z + Math.random() * Math.PI / 4) % 6.28) * 1000) / 1000;
        }
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: block.jump,
            forward: true,
            sneak: block.sneak
        });
        this.applyControl(delta);
        this.sendState();

        // check if near nest
        const spawn_distance = mob.pos.distance(mob.pos_spawn);
        if(spawn_distance < 1) {
            const world = mob.getWorld();
            const tblock = world.getBlock(mob.pos_spawn.floored());
            if(tblock && tblock.hasTag('bee_nest')) {
                console.log('found BeeNest');
                const nest = new BeeNest(tblock);
                await nest.appendMob(mob);
            }
        }
    }

    // сбор пыльцы
    doPollen(delta) {
        const mob = this.mob;
        this.updateControl({
            yaw: mob.rotate.z,
            jump: false,
            forward: false,
            sneak: true
        });
        this.applyControl(delta);
        this.sendState();
        if (mob.extra_data.pollen >= MAX_POLLEN) {
            mob.extra_data.pollen = MAX_POLLEN;
            console.log("[AI] doReturnToHome");
            this.ticks_pollination = 0;
            this.stack.replaceState(this.doReturnToHome);
        } else {
            mob.extra_data.pollen += POLLEN_PER_TICK;
        }
    }

    // просто полет
    doForward(delta) {
        const mob = this.mob;
        
        const block = this.getFlightBlocks(true);
        
        if (Math.random() < 0.02) {
           mob.rotate.z = Math.round(((mob.rotate.z + Math.random() * Math.PI / 4) % 6.28) * 1000) / 1000;
        }
        
        const hive_distance = mob.pos.distance(mob.pos_spawn);
        if (hive_distance > this.back_distance) {
            mob.rotate.z = this.angleTo(mob.pos_spawn);
        }
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: block.jump,
            forward: true,
            sneak: block.sneak
        });
        this.applyControl(delta);
        this.sendState();
        
        // если на уровне ног есть цветок
        if (block.legs.hasTag('flower')) {
            if(mob.extra_data.pollen < MAX_POLLEN && this.ticks_pollination > 300) {
                console.log("[AI] doPollen");
                this.stack.replaceState(this.doPollen);
            }
        }
        
        // если наступил вечер или набрали пыльцы, то меняем состояние на "лететь в улей"
        const world = mob.getWorld();
        const time = world.info.calendar.day_time;
        if (time < 6000 || time > 18000 || mob.extra_data.pollen >= MAX_POLLEN) {
            console.log("[AI] doReturnToHome");
            this.stack.replaceState(this.doReturnToHome);
        }
        
        this.ticks_pollination++;
        mob.extra_data.pollen -= POLLEN_PER_TICK / 10;
    }

    // преследование игрока
    doFollow(delta) {
        const mob = this.mob;
        
        if (!this.target) {
            this.stack.replaceState(this.doForward);
            return;
        }
        
        const player = mob.getWorld().players.get(this.target);
        if (!player || mob.playerCanBeAtacked(player)) {
            this.target = null;
            this.stack.replaceState(this.doForward);
            return;
        }
        
        const distance = mob.pos.horizontalDistance(player.state.pos);
        if (distance > this.follow_distance) {
            this.target = null;
            this.stack.replaceState(this.doForward);
            return;
        }
        
        mob.rotate.z = this.angleTo(player.state.pos);
        
        if (this.ticks_anger <= this.anger_time) {
            if (Math.abs(player.state.pos.y + 2 - mob.pos.y) < 0.5 && this.ticks_attack > this.interval_attack && distance < this.distance_attack) {
                this.ticks_attack = 0;
                player.changeLive(-this.damage);
                const world = mob.getWorld();
                const actions = new PickatActions();
                actions.addPlaySound({ tag: 'madcraft:block.player', action: 'hit', pos: player.state.pos.clone() }); // Звук получения урона
                world.actions_queue.add(player, actions);
                
            }
            this.ticks_attack++;
            this.ticks_anger++;
            if (this.ticks_anger == this.anger_time) {
                this.target = null;
                this.stack.replaceState(this.doForward);
                return;
            }
        }
        
        const block = this.getFlightBlocks(true);
        const forward = (distance > 1.5) ? true : false;
        this.updateControl({
            yaw: mob.rotate.z,
            jump: block.jump,
            forward: forward,
            sneak: block.sneak
        });
        this.applyControl(delta);
        this.sendState();
        
        this.ticks_pollination++;
        mob.extra_data.pollen -= POLLEN_PER_TICK / 10;
    }
    
    onDamage(actor, val, type_damage) {
        const id = actor.session.user_id;
        const mob = this.mob;
        const world = mob.getWorld();
        const bots = world.getMobsNear(mob.pos, this.back_distance);
        for (const bot of bots) {
            if (bot.type == "bee") {
                bot.getBrain().setCommonTarget(id);
            }
        }
        this.setCommonTarget(id);
    }
    
    // установка общего таргета для атаки (атака роем)
    setCommonTarget(id) {
        this.target = id;
        this.ticks_anger = 0;
        this.stack.replaceState(this.doFollow);
    }
    
}