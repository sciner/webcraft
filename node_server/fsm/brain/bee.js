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
            playerHeight: 0.9,
            stepHeight: 1,
            playerHalfWidth: 0.5,
        });
        
        this.pc.player_state.flying = true;//TO DO костыль от сброса полета при касании земли
        
        this.pollen_count = 0;
        this.ticks_pollination = 0;
        this.ticks_anger = 0;
        this.ticks_attack = 0;
        
        //consts
        this.interval_attack = 16;
        this.follow_distance = 10;
        this.anger_time = 300;
        
        this.stack.pushState(this.doStand);
        
    }
    
    getFlightBlocks() {
        this.pc.player_state.flying = true; //TO DO костыль от сброса полета при касании земли
        const mob = this.mob;
        const world = mob.getWorld();
        const chunk = world.chunks.get(mob.chunk_addr);
        if (!chunk) {
            return null;
        }
        
        const pos_body = mob.pos.add(new Vector(Math.sin(mob.rotate.z), 0, Math.cos(mob.rotate.z)).floored());
        const pos_legs = mob.pos.sub(new Vector(0, 1, 0));
        const body = chunk.getBlock(pos_body);
        const legs = chunk.getBlock(pos_legs);
        
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
        if (spawn_distance < 1) {
            this.nectar_count = 0;
            console.log("[AI] doForward");
            this.stack.replaceState(this.doForward);
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
        
        if (!mob || !mob.pos || !mob.pos_spawn) {
            return;
        }
        
        const block = this.getFlightBlocks();

        if (Math.random() < 0.02) {
           mob.rotate.z = Math.round(((mob.rotate.z + Math.random() * Math.PI / 4) % 6.28) * 1000) / 1000;
        }
        
        const hive_distance = mob.pos.distance(mob.pos_spawn);
        if (hive_distance > 22) {
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
        
        this.ticks_pollination++;
    }
    
    doFollow(delta) {
        const mob = this.mob;
        
        if (!this.target) {
            this.stack.replaceState(this.doForward);
            return;
        }
        
        const player = mob.getWorld().players.get(this.target);
        if (!player || player.game_mode.isSpectator()) {
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
            if (Math.abs(player.state.pos.y + 2 - mob.pos.y) < 0.5 && this.ticks_attack > this.interval_attack) {
                console.log(" attack ");
                this.ticks_attack = 0;
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
        const bots = this.get
        this.setCommonTarget(actor.session.user_id);
    }
    
    setCommonTarget(id) {
        this.target = id;
        this.ticks_anger = 0;
        this.stack.replaceState(this.doFollow);
    }
    
    /*
    doFloat(delta) {
        const mob = this.mob;
        mob.rotate.z = Math.round(((mob.rotate.z + this.float_radius) % 6.28) * 100 ) / 100;
        
        if (Math.random())
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: false,
            forward: true,
            sneak: false
        });
        this.applyControl(delta);
        this.sendState();
        console.log(mob.pos)
    }
    
    doPanic(delta) {
        const mob = this.mob;
        
        if (mob.pos_spawn.y + 7 < mob.pos.y) {
            console.log("AI doBack")
            this.stack.replaceState(this.doBack);
            return;
        }
        
        mob.rotate.z = this.rotate_angle = Math.round(((mob.rotate.z + 0.1) % 6.28) * 100 ) / 100;
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: true,
            forward: true,
            sneak: false
        });
        this.applyControl(delta);
        this.sendState();
        
    }
    
    doForward(delta) {
        const mob = this.mob;
        let sneak = false;
         let jump = false;
        if ( mob.pos_spawn.y + this.hight_fly > mob.pos.y) {
            sneak = false;
            jump = true;
        } else {
            sneak = true;
            jump = false;
        }
         
        mob.rotate.z = Math.round(((mob.rotate.z + this.rotate_angle) % 6.28) * 100 ) / 100;
         
        this.updateControl({
            yaw: mob.rotate.z,
            jump: jump,
            forward: true,
            sneak: sneak
        });
        this.applyControl(delta);
        this.sendState();
        
        if (Math.random() < 0.005) {
                console.log("AI doStand")
                this.stack.replaceState(this.doStand);
            }
    }
    
    doStand(delta) {
        const mob = this.mob;
        //const block = this.getFlightBlocks();
        
       // this.rotate_angle = Math.round((this.rotate_angle % 6.28) * 100 ) / 100;
        //if (Math.abs(Math.abs(mob.rotate.z % 6.28) - this.rotate_angle) > 0.5) {
        //    mob.rotate.z += 0.2;
        //} else {
        //    mob.rotate.z = this.rotate_angle;
        //}
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: false,
            forward: false,
            sneak: false
        });
        this.applyControl(delta);
        this.sendState();
        
        //if (mob.rotate.z == this.rotate_angle) {
            if (Math.random() < 0.1) {
                this.hight_fly = Math.random() * 3 | 0;
                this.rotate_angle = Math.random() + 0.01;
                console.log("AI doForward" + this.hight_fly)
                this.stack.replaceState(this.doForward);
            }
       // }
    }
    
    doBack(delta) {
        const mob = this.mob;
        mob.rotate.z = this.rotate_angle = this.angleTo(mob.pos_spawn);
        let sneak = false;
        if (Math.abs(mob.pos.y - mob.pos_spawn.y) > 1) {
            sneak = true;
        }
        let forward = false;
        const back_distance = mob.pos.distance(mob.pos_spawn);
        if (back_distance > 2) {
            console.log(mob.rotate.z + "=" + this.rotate_angle);
            forward = true;
        } else {
            this.stack.replaceState(this.doStand);
            console.log("AI stop");
            return;
        }
            
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: false,
            forward: forward,
            sneak: sneak
        });
        this.applyControl(delta);
        this.sendState();
    }
    
    /*
    getFlightBlocks() {
        const mob = this.mob;
        const world = mob.getWorld();
        const chunk_over = world.chunks.get(mob.chunk_addr);
        if (!chunk_over) {
            return null;
        }
        let under = null;
        for (let i = 1; i < 20; i++) {
            let vec = mob.pos.sub(new Vector(Math.sin(mob.rotate.z), i, Math.cos(mob.rotate.z))).floored()
            under = chunk_over.getBlock(vec);
            if (under.id == -1){
                console.log(i + " " + under.id + " " + vec + " " + chunk_addr)
            }
            if (under.id > 0) {
                break;
            }
        }
        const pos_head = mob.pos.add(new Vector(Math.sin(mob.rotate.z), 1, Math.cos(mob.rotate.z)));
        const pos_body = mob.pos.add(new Vector(Math.sin(mob.rotate.z), 0, Math.cos(mob.rotate.z)));
        const head = chunk_over.getBlock(pos_head);
        const body = chunk_over.getBlock(pos_body);
        return { 'under': under, 'head': head, 'body': body }
     }
    
    doStand(delta) {
        const mob = this.mob;
        const block = this.getFlightBlocks();
        if (!block) {
            console.log("!block");
            return;
        }
        
        if (block.body.id != 0) {
            this.rotate_angle += Math.PI / 60;
            mob.rotate.z = this.rotate_angle;
        }
        
        this.rotate_angle = Math.round((this.rotate_angle % 6.28) * 100 ) / 100;
        if (Math.abs(Math.abs(mob.rotate.z % 6.28) - this.rotate_angle) > 0.5) {
            mob.rotate.z += 0.2;
        } else {
            mob.rotate.z = this.rotate_angle;
        }
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: false,
            forward: false,
            sneak: false
        });
        this.applyControl(delta);
        this.sendState();
        
        if (Math.random() < 0.05) {
            console.log("[AI] forward " + mob.pos);
          //  this.stack.replaceState(this.doForward);
            return;
        }
    }
    
    doForward(delta) {
        const mob = this.mob;
        const block = this.getFlightBlocks();
        if (!block) {
            console.log("!block");
            return;
        }
        let jump = false;
        let sneak = false;
        if (block.under.id != -1){
        if (block.under.posworld.y > mob.pos.y - 4) {
            jump = true;
            sneak = false;
        } else if (block.under.posworld.y < mob.pos.y - 5) {
            jump = true;
            sneak = false;
        }
        }
        
        const back_distance = mob.pos.distance(mob.pos_spawn);
        if ( back_distance > 8) {
            this.rotate_angle = this.angleTo(mob.pos_spawn);
            mob.rotate.z = this.rotate_angle;
        }
        
        
        if (block.body.id != 0) {
            console.log("[AI] stnd random " + block.body.id);
            this.rotate_angle = mob.rotate.z + (Math.PI / 2) + Math.random() * Math.PI / 2;
            this.stack.replaceState(this.doStand);
            return;
        }
        console.log(jump + " " + sneak);
        this.updateControl({
            yaw: mob.rotate.z,
            jump: jump,
            forward: true,
            sneak: sneak
        });
        this.applyControl(delta);
        this.sendState();
        
        if (Math.random() < 0.05) {
            if (Math.random() < 0.1) {
                this.rotate_angle = 2 * Math.random() * Math.PI;
            }
            console.log("[AI] stnd " + block.body.id);
            this.stack.replaceState(this.doStand);
        }
        
        
    }
    
    
    getFlightBlocks() {
        const mob = this.mob;
        const world = mob.getWorld();
        const chunk_over = world.chunks.get(mob.chunk_addr);
        if (!chunk_over) {
            return null;
        }
        let under = null;
        let body = null;
        let sneak = false;
        let jump = false;
        for (let i = 0; i < 20; i++) {
            under = chunk_over.getBlock(mob.pos.sub(new Vector(Math.sin(mob.rotate.z), i, Math.cos(mob.rotate.z))).floored());
            if (i == 0) {
                body = under;
            }
            if (under.id > 0) {
                if ((under.posworld.y + 3) > Math.round(mob.pos.y)) {
                    sneak = false;
                    jump = true;
                } else {
                    sneak = true;
                    jump = false;
                }
                break;
            }
        }
        const pos_head = mob.pos.add(new Vector(Math.sin(mob.rotate.z), this.height + 1, Math.cos(mob.rotate.z))).floored();
        const head = chunk_over.getBlock(pos_head);
        return { 'sneak': sneak, 'jump': jump, 'under': under, 'head': head, 'body': body }
    }

    doStand(delta) {
        const mob = this.mob;
        const block = this.getFlightBlocks();
        
        this.rotate_angle = Math.round((this.rotate_angle % 6.28) * 100 ) / 100;
        if (Math.abs(Math.abs(mob.rotate.z % 6.28) - this.rotate_angle) > 0.5) {
            mob.rotate.z += 0.2;
        } else {
            mob.rotate.z = this.rotate_angle;
        }
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: block.jump,
            forward: false,
            sneak: block.sneak
        });
        this.applyControl(delta);
        this.sendState();
        
        if (Math.random() < 0.05) {
            console.log("[AI] forward");
            this.stack.replaceState(this.doForward);
            return;
        }
        
        if (Math.random() < 0.05) {
            console.log("[AI] fly");
            this.stack.replaceState(this.doFly);
            return;
        }
    }
    
    doBack(delta) {
        const mob = this.mob;
        const block = this.getFlightBlocks();
        mob.rotate.z = this.rotate_angle;
        
        if (block.head.id != 0) {
            this.rotate_angle = mob.rotate.z + (Math.PI / 2) + Math.random() * Math.PI / 2;
            this.stack.replaceState(this.doStand);
            return;
        }
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: block.jump,
            forward: true,
            sneak: block.sneak
        });
        this.applyControl(delta);
        this.sendState();
        
        const back_distance = mob.pos.distance(mob.pos_spawn);
        if (back_distance < 0.5) {
            console.log("[AI] back stand");
            this.stack.replaceState(this.doStand);
        }
        console.log(back_distance + " pos: " + mob.pos + " block: " + block.under.posworld);
    }
    
    doFly(delta) {
        const mob = this.mob;
        const block = this.getFlightBlocks();
        let sneak = false;
        let jump = false;
        if (block.under.posworld.y < mob.pos.y + 3 && block.body.id == 0) {
            jump = false;
            sneak = true;
        } else {
            jump = true;
            sneak = false;
        }
        
        if (block.head.id != 0) {
            this.rotate_angle = mob.rotate.z + (Math.PI / 2) + Math.random() * Math.PI / 2;
            this.stack.replaceState(this.doStand);
            return;
        }
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: block.jump,
            forward: false,
            sneak: block.sneak
        });
        this.applyControl(delta);
        this.sendState();
    }
    
    doForward(delta) {
        const mob = this.mob;
        const block = this.getFlightBlocks();
        let jump = false;
        let sneak = false;
        if (block.body.id == 0) {
            if (block.under.posworld.y < mob.pos.y + 3) {
                jump = false;
                sneak = true;
            } else {
                jump = true;
                sneak = false;
            }
        } else {
            jump = true;
            sneak = false;
            if (block.head.id != 0) {
                this.rotate_angle = mob.rotate.z + (Math.PI / 2) + Math.random() * Math.PI / 2;
                this.stack.replaceState(this.doStand);
                return;
            }
        }
        
        this.updateControl({
            yaw: mob.rotate.z,
            jump: block.jump,
            forward: true,
            sneak: block.sneak
        });
        this.applyControl(delta);
        this.sendState();
        
        const back_distance = mob.pos.distance(mob.pos_spawn);

    }
    */
    
}