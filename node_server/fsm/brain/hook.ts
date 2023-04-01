import { FSMBrain } from "../brain.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { PLAYER_STATUS } from "@client/constant.js";
import { Weather } from "@client/block_type/weather.js";
import { FLUID_LAVA_ID, FLUID_TYPE_MASK, FLUID_WATER_ID } from "@client/fluid/FluidConst.js";

// рыба
const FISH = [
    {
        'name': 'COD',
        'weight': 60
    },
    {
        'name': 'SALMON',
        'weight': 25
    },
    {
        'name': 'TROPICAL_FISH',
        'weight': 2
    },
    {
        'name': 'PUFFERFISH',
        'weight': 13
    }
]
// мусор
const JUNK = [
    {
        'name': 'LILY_PAD',
        'weight': 17
    },
    {
        'name': 'FISHING_ROD',
        'weight': 2
    },
    {
        'name': 'LEATHER',
        'weight': 2
    },
    {
        'name': 'LEATHER_BOOTS',
        'weight': 10
    },
    {
        'name': 'ROTTEN_FLESH',
        'weight': 10
    },
    {
        'name': 'STICK',
        'weight': 5
    },
    {
        'name': 'STRING',
        'weight': 5
    },
    {
        'name': 'AWKWARD',
        'weight': 10
    },
    {
        'name': 'BONE',
        'weight': 10
    },
    {
        'name': 'BOWL',
        'weight': 10
    },
    {
        'name': 'INK_SAC',
        'weight': 1
    }
]

export class Brain extends FSMBrain {

    parent: any;
    timer_in_ground: number;
    timer_catchable: number;
    timer_caught_delay: number;
    timer_catchable_delay: number;
    fish_approach_angle: number;
    velocity: Vector;

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            playerHeight: .16,
            playerHalfWidth: .08
        });
        this.pc.player_state.flying = true
        mob.extra_data.play_death_animation = false
        
        this.health = 1; // максимальное здоровье
        
        this.timer_in_ground = 0
        this.timer_catchable = 0
        this.timer_caught_delay = 0
        this.timer_catchable_delay = 0
        this.fish_approach_angle = 0

        const power = 0.4
        const z = Math.cos(mob.rotate.z) * Math.cos(mob.rotate.x) * power
        const x = Math.sin(mob.rotate.z) * Math.cos(mob.rotate.x) * power
        const y = Math.sin(mob.rotate.x) * power
        this.velocity = new Vector(x, y, z)
        this.stack.pushState(this.doStand)
    }

    onLive() {

    }

    doStand(delta) {
        const mob = this.mob
        const player = mob.parent
        if (!player) {
            mob.kill()
            return
        }
        const world = mob.getWorld()
        const item = player.inventory.items[player.inventory.current.index]
        if (player.status == PLAYER_STATUS.DEAD || !item || item.id != world.block_manager.FISHING_ROD.id || mob.pos.distance(player.state.pos) > 32) {
            player.fishing = null
            mob.kill()
            return
        }
        const ground = world.getBlock(mob.pos.floored())
        if (!ground || (ground.fluid & FLUID_TYPE_MASK ) === FLUID_LAVA_ID) {
            player.fishing = null
            mob.kill()
            return
        }
        if (ground.id != 0) {
            if (this.timer_in_ground++ > 1200) {
                player.fishing = null
                mob.kill()
            }
            return
        }
        let acceleration = .92
        if (ground.id == 0 && ground.fluid != 0) {
            this.pc.player_state.vel = new Vector(0, 0, 0)
        }
        let force = 0
        // находим глубину погружения
        for (let i = 0; i < 10; i++) {
            const water = world.getBlock(mob.pos.offset(0, i / 10, 0).floored())
            if (water?.id == 0 && (water.fluid & FLUID_TYPE_MASK ) === FLUID_WATER_ID) {
                force += .2625
            }
        }
        if (force > 0) {
            let bonus = 1
            if (Math.random() < .25 && world.weather == Weather.RAIN) {
                bonus = 2
            }
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
                    const actions = new WorldAction()
                    actions.addParticles([{type: 'bubble', pos: mob.pos}])
                    world.actions_queue.add(player, actions)
                    // тянем рыбу
                } else {
                    // рыба близка пузыри с позицией
                    // показать косяк рыб
                    const x = mob.pos.x + Math.sin(this.fish_approach_angle) * this.timer_catchable_delay * .1
                    const y = mob.pos.y
                    const z = mob.pos.z + Math.cos(this.fish_approach_angle) * this.timer_catchable_delay * .1
                    const pos = new Vector(x, y, z)
                    const block = world.getBlock(pos)
                    if (block && block.id == 0 && block.fluid != 0 && Math.random() < .15) {
                        const actions = new WorldAction()
                        actions.addParticles([{type: 'bubble', pos: pos}])
                        world.actions_queue.add(player, actions)
                    }
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
                    this.fish_approach_angle = (Math.random() * 6.28) | 0
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
            this.velocity.y *= .9
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
        const mob = this.mob
        const player = mob.parent
        player.fishing = null
        mob.kill()
        if (this.timer_catchable <= 0) {
            return
        }
        // @todo добавить чары удачи и удачи в море и наверное биомы
        let  base = Math.random()
        const luck_of_sea = 0
        const lure = 0
        let chance_one = .1 - luck_of_sea * .025 - lure * .01
        let chance_two = .05 + luck_of_sea * .01 - lure * .01
        chance_one = Math.min(Math.max(0, chance_one), 1)
        chance_two = Math.min(Math.max(0, chance_two), 1)
        if (base < chance_one) {
            this.createDrop(this.getRandomItem(JUNK))
        } else {
            base -= chance_one
            if (base < chance_two) {
                console.log('TREASURE')
            } else {
                this.createDrop(this.getRandomItem(FISH))
            }
        }
    }

    createDrop(title) {
        const mob = this.mob
        const player = this.mob.parent
        const world = mob.getWorld()
        const bm = world.block_manager
        const block = bm.fromName(title)
        if (!block) {
            return
        }
        const actions = new WorldAction()
        const pos = player.state.pos.add(player.forward)
        actions.addDropItem({ pos: pos, items: [{ id: block.id, count: 1 }], force: true })
        actions.decrement_instrument = {id: 0}
        world.actions_queue.add(player, actions)
    }

    getRandomItem(list) {
        let all = 0
        for (const el of list) {
            all += el.weight
        }
        let chance = (Math.random() * all) | 0
        for (const el of list) {
            chance -= el.weight
            if (chance < 0) {
                return el.name
            } 
        }
    }

}