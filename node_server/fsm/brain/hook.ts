import { FSMBrain } from "../brain.js";
import { BLOCK } from "@client/blocks.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { EnumDamage } from "@client/enums/enum_damage.js";
import { ServerClient } from "@client/server_client.js";

export class Brain extends FSMBrain {
    timer_in_ground: number;
    timer_shake: number;
    timer_catchable: number;
    timer_caught_delay: number;
    timer_catchable_delay: number;
    vel_y: number;

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 0,
            playerHeight: .4,
            stepHeight: 0,
            playerHalfWidth: .08
        });
        this.pc.player_state.flying = true
        this.stack.pushState(this.doStand);
        this.health = 1; // максимальное здоровье
        const f = 0.8
        const mZ = Math.cos(mob.rotate.z) * Math.cos(mob.rotate.x) * f
        const mX = Math.sin(mob.rotate.z) * Math.cos(mob.rotate.x) * f
        const mY = Math.sin(mob.rotate.x) * f
        this.pc.player_state.vel.addSelf(new Vector(mX, mY, mZ))
        this.timer_in_ground = 0
        this.timer_shake = 0

        this.timer_catchable = 0

        this.vel_y = 0
    }

    onLive() {

    }

    doStand(delta) {
        const mob = this.mob;
        const world = mob.getWorld()
        const ground = world.getBlock(mob.pos.floored())

        if (ground.id != 0) {
            if (this.timer_in_ground++ > 1200) {
                console.log('auto kill')
                mob.kill()
            }
            return
        } else {
            if (ground.fluid != 0) {
                this.pc.player_state.vel.addSelf(new Vector(0, 0.02, 0))
            }
        }

        let f6 = .92
        let d10 = 0

        if (d10 > 0) {
            if (this.timer_catchable > 0) {
                this.timer_catchable--
                if (this.timer_catchable <= 0) {
                    this.timer_caught_delay = 0
                    this.timer_catchable_delay = 0
                }
            } else if (this.timer_catchable_delay > 0) {
                this.timer_catchable_delay -= 1
                if (this.timer_catchable_delay <= 0) {
                    console.log('пузыри')
                    this.timer_catchable = (Math.random() * 20) | 0 + 10 
                } else {
                    console.log('пузыри 2')
                }
            } else if (this.timer_caught_delay > 0) {
                this.timer_caught_delay -= 1
                let f1 = 0.15
                if (this.timer_caught_delay < 20) {
                    f1 += (20 - this.timer_caught_delay) * 0.05
                } else if (this.timer_caught_delay < 40) {
                    f1 += (40 - this.timer_caught_delay) * 0.02
                } else if (this.timer_caught_delay < 60) {
                    f1 += (60 - this.timer_caught_delay) * 0.01
                }
                if (Math.random() < f1) {
                    console.log('брызги')
                }
            } else {
                this.timer_caught_delay = (Math.random() * 800) | 0 + 100 //  MathHelper.getRandomIntegerInRange(this.rand, 100, 900);
                //удача на рыбку
            }

            if (this.timer_catchable > 0) {
                this.vel_y -= Math.random() * Math.random()  * Math.random()  * 0.2
            }
        }


        let d11 = d10 * 2.0 - 1.0;
        this.vel_y += 0.03999999910593033 * d11

        if (d10 > 0.0){
            f6 *= 0.9
            this.vel_y *= 0.8
        }

        //if (ground)

       /* if (ground.id != 0) {
            if (this.timer_in_ground++ > 1200) {
                console.log('auto kill')
                mob.kill()
            }
            return
        } 

        if (ground.id == 0 && ground.fluid != 0) {
            this.pc.player_state.flying = true
            this.pc.player_state.vel.addSelf(new Vector(0, 0.02, 0))
        } else {
           // if ((this.timer_shake++ % 100) == 0 ) {
            //    console.log('xyjak')
            //    this.pc.player_state.vel.addSelf(new Vector(0, -2, 0))
          //  } else {
            //    this.pc.player_state.vel.addSelf(new Vector(0, -0.005, 0))
           // }
        }

        /*if (ground.id != 0) {
            if (this.timer_in_ground++ > 12000) {
                console.log('auto kill')
                mob.kill()
            }
        } else {
            
            this.updateControl({
                yaw: mob.rotate.z,
                forward: false,
                jump: false,
                sneak: true
            });
            this.applyControl(delta)
            this.sendState()
       // }
       */
    }
   
    // Если убили моба
    onKill(actor, type_damage) {
        console.log('kill')
    }
    
    // если использовали предмет
    onUse(actor, id) {
        console.log('use')
        return false
    }
    
}