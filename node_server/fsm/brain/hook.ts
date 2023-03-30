import { FSMBrain } from "../brain.js";
import { BLOCK } from "@client/blocks.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { EnumDamage } from "@client/enums/enum_damage.js";
import { ServerClient } from "@client/server_client.js";
import { PLAYER_STATUS } from "@client/constant.js";

export class Brain extends FSMBrain {

    parent: any;

    timer_in_ground: number;
    timer_shake: number;
    timer_catchable: number;
    timer_caught_delay: number;
    timer_catchable_delay: number;
    vel_y: number;
    velocity: Vector;

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
        
        this.health = 1; // максимальное здоровье
        
        this.timer_in_ground = 0
        this.timer_catchable = 0
        this.timer_caught_delay = 0
        this.timer_catchable_delay = 0

        const power = .2
        const mZ = Math.cos(mob.rotate.z) * Math.cos(mob.rotate.x) * power
        const mX = Math.sin(mob.rotate.z) * Math.cos(mob.rotate.x) * power
        const mY = Math.sin(mob.rotate.x) * 2 * power
        this.velocity = new Vector(mX, mY, mZ)
        this.stack.pushState(this.doStand)
    }

    onLive() {

    }

    doStand(delta) {
        const mob = this.mob
        const player = this.mob.parent

        if (!player) {
            mob.kill()
            return
        }
        const world = mob.getWorld()
        const item = player.inventory.items[player.inventory.current.index]
        if (player.status == PLAYER_STATUS.DEAD || !item || item.id != world.block_manager.FISHING_ROD.id || mob.pos.distance(player.state.pos) > 1024) {
            player.fishing = null
            mob.kill()
            return
        }

        const ground = world.getBlock(mob.pos.floored())
        if (ground.id != 0) {
            if (this.timer_in_ground++ > 1200) {
                mob.kill()
            }
            return
        }

        let acceleration = 0.92
        let force = 0
        // находим глубину погружения
        for (let i = 0; i < 10; i++) {
            const water = world.getBlock(mob.pos.offset(0, i / 8, 0).floored())
            if (water?.id == 0 && water.fluid != 0) {
                force += .28
            }
        }
        if (force > 0) {
            let bonus = 1
            if (this.timer_catchable > 0) {
                this.timer_catchable--
                if (this.timer_catchable <= 0) {
                    this.timer_caught_delay = 0
                    this.timer_catchable_delay = 0
                }
            } else if (this.timer_catchable_delay > 0) {
                this.timer_catchable_delay -= bonus
                if (this.timer_catchable_delay <= 0) {
                    this.velocity.y -= 0.2
                    this.timer_catchable = (Math.random() * 20) | 0 + 10 
                    // тянем рыбу
                } else {
                    // рыба близка пузыри с позицией
                }
            } else if (this.timer_caught_delay > 0) {
                this.timer_caught_delay -= bonus
                let chance_spray = 0.15
                if (this.timer_caught_delay < 20) {
                    chance_spray += (20 - this.timer_caught_delay) * .05
                } else if (this.timer_caught_delay < 40) {
                    chance_spray += (40 - this.timer_caught_delay) * .02
                } else if (this.timer_caught_delay < 60) {
                    chance_spray += (60 - this.timer_caught_delay) * .01
                }
                if (Math.random() < chance_spray) {
                    // брызги
                }
                if (this.timer_caught_delay <= 0) {
                    this.timer_catchable_delay = (Math.random() * 60) | 0 + 20 
                }
            } else {
                this.timer_caught_delay = (Math.random() * 800) | 0 + 100
                // удача на рыбку
            }

            if (this.timer_catchable > 0) {
                this.velocity.y -= Math.random() * Math.random() * Math.random() * .2;
            }
        }

        this.velocity.y += .04 * (force * 2 - 1)

        if (force > 0) {
            acceleration *= .9
            this.velocity.y *= .8
        }

        this.velocity.x *= acceleration
        this.velocity.y *= acceleration
        this.velocity.z *= acceleration

        this.pc.player_state.vel.addSelf(this.velocity)

        this.applyControl(delta)
        this.sendState()
    }
   
    // Если убили моба
    onKill(actor, type_damage) {
    }
    
    // если использовали предмет
    onUse(actor, id) {
        return false
    }

    onFishing() {
        // @todo добавить чары удачи и удачи в море
        let  base = Math.random()
        const luck_of_sea = 0
        const lure = 0
        let chance_one = .1 - luck_of_sea * .025 - lure * .01
        let chance_two = .05 + luck_of_sea * .01 - lure * .01
        chance_one = Math.min(Math.max(0, chance_one), 1)
        chance_two = Math.min(Math.max(0, chance_two), 1)

        if (base < chance_one) {
            console.log('JUNK')
        } else {
            base -= chance_one
            if (base < chance_two) {
                console.log('TREASURE')
            } else {
                console.log('FISH')
            }
        }
        this.mob.kill()
    }
    
}