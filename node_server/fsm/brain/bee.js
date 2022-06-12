import { FSMBrain } from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { PickatActions } from "../../../www/js/block_action.js";
import { getChunkAddr } from "../../../www/js/chunk_const.js";


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
        
        this.pc.player_state.flying = true;//TO DO костыль от сброса полета при касании земли
        
        this.pollen_count = 0;
        this.ticks_pollination = 0;
        this.ticks_anger = 0;
        this.ticks_attack = 0;
        
        //consts
        this.distance_attack = 1.5;
        this.interval_attack = 16;
        this.follow_distance = 10;
        this.back_distance = 10;
        this.anger_time = 300;
        this.demage = 2;
        this.live = 10;
        
        this.stack.pushState(this.doForward);
        
    }
    
    getFlightBlocks() {
        this.pc.player_state.flying = true; //TO DO костыль от сброса полета при касании земли
        const mob = this.mob;
        const world = mob.getWorld();
        
        const pos_body = new Vector(Math.sin(mob.rotate.z), 0, Math.cos(mob.rotate.z)).addSelf(mob.pos).flooredSelf();
        const pos_legs = mob.pos.sub(Vector.YP).flooredSelf();
        const body = world.getBlock(pos_body);
        const legs = world.getBlock(pos_legs);
        
        if (legs.id != 0 && legs.material.style == "default") {
            this.fly = Math.random() * 50 | 0;
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
        
        return {'body': body, 'legs': legs, 'jump': jump, 'sneak': sneak };
    }
    
    doHive(delta) {
        const mob = this.mob;
        
        this.updateControl({
            yaw: 0,
            jump: false,
            forward: false,
            sneak: false
        });
        this.applyControl(delta);
        this.sendState();
        
        const world = mob.getWorld();
        world.updateWorldCalendar();
        const time = world.info.calendar.day_time;
        if (time > 6000 && time < 18000) {
            console.log("[AI] doForward");
            this.stack.replaceState(this.doForward);
        }
    }
    
    doBack(delta) {
        const mob = this.mob;
        const block = this.getFlightBlocks();
        
        mob.rotate.z = this.angleTo(mob.pos_spawn);
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: block.jump,
            forward: true,
            sneak: block.sneak
        });
        this.applyControl(delta);
        this.sendState();
        
        const spawn_distance = mob.pos.distance(mob.pos_spawn);
        if (spawn_distance < 1) { //TO DO поправить когда будет улей
            this.nectar_count = 0;
            console.log("[AI] doHive");
            this.stack.replaceState(this.doHive);
        }
    }
    
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
        if (this.pollen_count > 4) {
            this.pollen_count = 4;
            console.log("[AI] doBack");
            this.ticks_pollination = 0;
            this.stack.replaceState(this.doBack);
        } else {
            this.pollen_count += 0.02;
        }
    }
    
    doForward(delta) {
        const mob = this.mob;
        
        const block = this.getFlightBlocks();
        
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
        
        if (block.legs.material.style == "planting" && this.pollen_count == 0 && this.ticks_pollination > 300) {
            console.log("[AI] doPollen");
            this.stack.replaceState(this.doPollen);
        }
        
        const world = mob.getWorld();
        world.updateWorldCalendar();
        const time = world.info.calendar.day_time;
        if (time < 6000 || time > 18000) {
            console.log("[AI] doBack");
            this.stack.replaceState(this.doBack);
        }
        
        this.ticks_pollination++;
    }
    
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
                player.changeLive(-this.demage);
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
        
        const block = this.getFlightBlocks();
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
    }
    
    onDemage(actor, val, type_demage) {
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
    
    setCommonTarget(id) {
        this.target = id;
        this.ticks_anger = 0;
        this.stack.replaceState(this.doFollow);
    }
    
}