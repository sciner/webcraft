import { FSMBrain } from "../brain.js";
import { Vector } from "../../../www/src/helpers.js";

export class Brain extends FSMBrain {
    rth_max_distance: number;
    follow_distance: number;
    live: number;
    fly: number;

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
        
        this.pc.player_state.flying = true; // @todo костыль от сброса полета при касании земли

        // consts
        this.rth_max_distance = 16;
        this.follow_distance = 10;
        this.live = 10;
        this.fly = 0;
        
        this.stack.pushState(this.doForward);
        
    }
    
    // поиск блоков под пчелой для полета и анализа есть ли там цветок
    getFlightBlocks() {

        // @todo костыль от сброса полета при касании земли
        this.pc.player_state.flying = true;
        const mob = this.mob;
        const world = mob.getWorld();
        
        const pos_body = new Vector(Math.sin(mob.rotate.z), 0, Math.cos(mob.rotate.z)).addSelf(mob.pos).flooredSelf();
        const pos_legs = mob.pos.sub(Vector.YP).flooredSelf();
        const body = world.getBlock(pos_body);
        const legs = world.getBlock(pos_legs);

        let jump = false;
        let sneak = false;
        if (this.fly > 0) {
            this.fly -= .3;
            jump = true;
            sneak = false;
        } else {
            jump = false;
            sneak = true;
        }
        
        return { body, legs, jump, sneak };
    }

    // просто полет
    doForward(delta) {
        const mob = this.mob;
        
        const block = this.getFlightBlocks();

        const spawn_distance = mob.pos.distance(mob.pos_spawn);
        if(spawn_distance > this.rth_max_distance) {
            mob.rotate.z = this.angleTo(mob.pos_spawn);
        } else {
            if (Math.random() < 0.02) {
                mob.rotate.z = Math.round(((mob.rotate.z + Math.random() * Math.PI / 4) % 6.28) * 1000) / 1000;
            }
        }

        let jump = block.jump;

        // если на уровне ног есть блок
        if (block.legs && block.legs.id != 0 && block.legs.material.style == 'default') {
            if(Math.random() < .1) {
                this.stack.replaceState(this.doStand);
                this.pc.player_state.flying = false;
            } else {
                if(this.fly <= 0) {
                    this.pc.player_state.flying = true;
                    this.fly = Math.random() * 20 | 0;
                    jump = true;
                }
            }
        }

        this.updateControl({
            yaw: mob.rotate.z,
            jump: jump,
            forward: true,
            sneak: block.sneak
        });
        this.applyControl(delta);
        this.sendState();

    }

    onPanic() {
        this.stack.replaceState(this.doStand);
    }

}