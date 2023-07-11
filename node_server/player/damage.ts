import { Effect } from "@client/block_type/effect.js";
import { Vector } from "@client/helpers.js";
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "@client/fluid/FluidConst.js";
import type { ServerPlayer } from "../server_player.js";
import { PLAYER_BURNING_TIME, PLAYER_STATUS } from "@client/constant.js";
import { EnumDamage } from "@client/enums/enum_damage.js";
import {TBlock} from "@client/typed_blocks3.js";
import {WorldAction} from "@client/world_action.js";
import {BLOCK_ACTION} from "@client/server_client.js";
import {IMMUNITY_DAMAGE_TIME} from "../server_player.js";

const MUL_1_SEC = 20
const INSTANT_DAMAGE_TICKS = 10
const INSTANT_HEALTH_TICKS = 10
const LIVE_REGENERATION_TICKS = 50
const FIRE_LOST_TICKS = 10
const FIRE_TIME = PLAYER_BURNING_TIME * MUL_1_SEC - 5
const OXYGEN_LOST_TICKS = 10
const OXYGEN_GOT_TICKS = 5
const POISON_TICKS = 25
const WITHER_TICKS = 40
const FOOD_LOST_TICKS = 80
const PLANTING_LOST_TICKS = 10
const PLANTING_PADDING_DAMAGE = 0.3
const MAX_UNDAMAGED_HEIGHT = 3
const LILY_PAD_BREAK_HEIGHT = 1.5 // падение с этой высоты разрушает кувшинку и защищает от урона. Должно быть <= MAX_UNDAMAGED_HEIGHT
const MAX_DAMAGE_ABSORPTION = 32

const tmpBlockLegs = new TBlock()
const tmpBlockHead = new TBlock()
const blockCache = Array.from({length: 6}, _ => new TBlock(null, new Vector(0,0,0)))

export class ServerPlayerDamage {
    player: ServerPlayer;
    oxygen_lost_timer: number = 0;
    oxygen_got_timer: number = 0;
    fire_lost_timer: number = 0;
    live_regen_timer: number = 0;
    poison_timer: number = 0;
    wither_timer: number = 0;
    food_timer: number = 0;
    food_saturation_level: number = 0;
    food_exhaustion_level: number = 0;
    planting_lost_timer: number = 0;
    instant_health_timer: number = 0;
    instant_damage_timer: number = 0;
    damage: number = 0
    type_damage : EnumDamage
    actor: any
    #ground = true              // находились ли мы на земле в прошлый раз
    #last_height = -Infinity    // высота, с которой отсчитывается нанесение урона при падении
    #timer_fire: number = 0
    #protectFallDamage = 0      // если > 0 - защищает от урона при падении. Уменьшается в безопасном месте

    constructor(player : ServerPlayer) {
        this.player = player;
    }

    /** Устанавливает флаг - однократно защитиь игрока от урона при падении. */
    protectFallDamage() {
        // 2 - чтобы обработаь ситуацияю после телепорта (флаг снимется если 2 раза подряд не на земле)
        this.#protectFallDamage = 2
    }

    /** Подсчитывает колличество урона и применяет его к игроку. */
    checkDamage(): void {
        const player = this.player
        if (player.game_mode.isSpectator()) {
            return
        }
        const mayGetDamaged = player.game_mode.mayGetDamaged() && player.timer_immunity + IMMUNITY_DAMAGE_TIME < performance.now()
        const {world, effects} = player
        const bm = world.block_manager
        const legsPos = player.state.pos.floored()
        const legs = world.getBlock(legsPos, tmpBlockLegs)
        const legsFluid = legs.fluid
        let damage = this.damage

        // Урон от падения. Этот код выполняется даже в креативном режиме, чтобы ломать кувшинки
        const {onGround, isOnLadder, flying} = player.controlManager.prismarine.player_state
        // если до этого был на земле, или сейчас в месте из/в/через которое безопасно падать
        if (this.#ground || isOnLadder || flying || player.in_portal || (legsFluid & FLUID_TYPE_MASK) === FLUID_WATER_ID) {
            this.#last_height = legsPos.y
            this.#protectFallDamage--
        } else if (onGround) { // если только что приземлился
            let height = (this.#last_height - legsPos.y) / player.scale
            if (height >= LILY_PAD_BREAK_HEIGHT) {
                // найти блоки кувшинок. Проверяем реальную форму через физику, т.к. игрок мог упасть на более высокое препятсвие рядом
                const underLegs = world.physics.getUnderLegs(player.controlManager.prismarine.player_state)
                let action: WorldAction | null = null
                for(const blockPos of underLegs) {
                    const mat = world.getMaterial(blockPos)
                    if (mat === bm.LILY_PAD) {
                        action = action ?? new WorldAction()
                        action.addBlock({
                            pos: blockPos,
                            item: { id: 0 },
                            destroy_block: {id: mat.id},
                            action_id: BLOCK_ACTION.DESTROY
                        })
                        action.addDropItem({
                            pos: blockPos,
                            items: [{id: mat.id, count: 1}],
                            force: true
                        })
                    }
                }
                if (action) {
                    height = 0
                    world.actions_queue.add(player, action)
                }
            }
            const power = height - MAX_UNDAMAGED_HEIGHT - effects.getEffectLevel(Effect.JUMP_BOOST)
            if (power > 0 && this.#protectFallDamage <= 0) {
                damage += power
            }
            this.#last_height = legsPos.y
            this.#protectFallDamage = 0
        } else {
            // Падаем. Но возможно в прыжке, и высота все еще нарастает.
            // Не уменьшать высоту, но можно увеличить - чтобы запомнить верхню точку траектории.
            this.#last_height = Math.max(this.#last_height, legsPos.y)
        }
        this.#ground = onGround

        if (!mayGetDamaged) {
            return
        }
        const eyePos = player.getEyePos()
        const head = world.getBlock(eyePos.floored(), tmpBlockHead)
        const body = world.getBlock(legsPos.offset(0, 1, 0), tmpBlockHead)
        const legsId = legs.id  // добсуп к id медленный, лучше 1 раз запомнить в переменной
        const headId = head.id
        const body_id = body.id
        const headFluid = head.fluid
        const body_fluid = body.fluid
        if (headId < 0 || legsId < 0 || body_id < 0) {
            return;
        }
        const legsNeighbours = legs.getNeighbours(player.world, blockCache)
        const ind_def = world.defaultPlayerIndicators
        let max_live = ind_def.live

        // эффект прилив здоровья
        const health_boost_lvl = effects.getEffectLevel(Effect.HEALTH_BOOST);
        max_live += 2 * health_boost_lvl;

        // Урон от голода
        if (this.food_exhaustion_level > 4) {
            this.food_exhaustion_level -= 4;
            if (this.food_saturation_level > 0) {
                this.food_saturation_level = Math.max(this.food_saturation_level - 1, 0);
            } else {
                player.food_level = Math.max(player.food_level - 1, 0);
            }
        }
        if (player.food_level >= 18) {
            this.food_timer++;
            if (this.food_timer >= FOOD_LOST_TICKS) {
                this.food_timer = 0;
                player.live_level = Math.min(player.live_level + 1, max_live);
                this.addExhaustion(3);
            }
        } else if (player.food_level <= 0) {
            this.food_timer++;
            if (this.food_timer >= FOOD_LOST_TICKS) {
                this.food_timer = 0;
                damage++;
            }
        } else {
            this.food_timer = 0;
        }
        // голод, дполнителное уменьшения насыщения от эффекта
        const hunger_lvl = effects.getEffectLevel(Effect.HUNGER);
        if (hunger_lvl > 0) {
            this.addExhaustion(0.025 * hunger_lvl);
        }
        // урон он воды и удушения эффект подводное дыханиеBLOCK.BUBBLE_COLUMN
        const is_asphyxiation = player.game_mode.current.asphyxiation;
        if (is_asphyxiation && !head.hasOxygenAt(eyePos)) {
            this.oxygen_got_timer = 0;
            this.oxygen_lost_timer++;
            if (this.oxygen_lost_timer >= OXYGEN_LOST_TICKS) {
                this.oxygen_lost_timer = 0;
                const resp_lvl = effects.getEffectLevel(Effect.RESPIRATION);
                if (resp_lvl == 0) {
                    player.oxygen_level =  Math.max(player.oxygen_level - 1, 0);
                }
                if (player.oxygen_level == 0) {
                    damage++;
                }
            }
        } else {
            this.oxygen_lost_timer = 0;
            this.oxygen_got_timer++;
            if (this.oxygen_got_timer >= OXYGEN_GOT_TICKS) {
                this.oxygen_got_timer = 0;
                player.oxygen_level =  Math.min(player.oxygen_level + 1, ind_def.oxygen);
            }
        }
        // огонь/лава с эффектом защиты от огня
        // проверяем ноги глаза и тело (для полублоков)
        const is_lava = (legsId == 0 && (legsFluid & FLUID_TYPE_MASK) === FLUID_LAVA_ID) || (headId == 0 && (headFluid & FLUID_TYPE_MASK) === FLUID_LAVA_ID || (body_id == 0 && (body_fluid & FLUID_TYPE_MASK) === FLUID_LAVA_ID))
        const is_fire = (legsId == bm.FIRE.id || legsId == bm.CAMPFIRE.id || headId == bm.FIRE.id || body_id == bm.FIRE.id)
        if (is_fire || is_lava) {
            this.fire_lost_timer++;
            if (this.fire_lost_timer >= FIRE_LOST_TICKS) {
                this.fire_lost_timer = 0;
                const fire_res_lvl = effects.getEffectLevel(Effect.FIRE_RESISTANCE);
                if (fire_res_lvl == 0) {
                    this.#timer_fire = FIRE_TIME
                    damage = is_lava ? damage + 4 : damage + 1;
                }
            }
        } else {
            this.fire_lost_timer = FIRE_LOST_TICKS
            // горение
            const fire_res_lvl = effects.getEffectLevel(Effect.FIRE_RESISTANCE)
            if ((legsFluid & FLUID_TYPE_MASK) === FLUID_WATER_ID || head.isWater || fire_res_lvl > 0) {
                this.#timer_fire = 0
            }
            if (this.#timer_fire > 0) {
                if ((this.#timer_fire % FIRE_LOST_TICKS) == 0) {
                    damage += 1
                }
                this.#timer_fire--
            }
        }

        // отравление
        const poison_lvl = effects.getEffectLevel(Effect.POISON);
        if (poison_lvl > 0) {
            this.poison_timer++;
            if (this.poison_timer >= (POISON_TICKS / (1 << (poison_lvl - 1)))) {
                this.poison_timer = 0;
                if (player.live_level > 1) {
                    damage++;
                }
            }
        } else {
            this.poison_timer = 0;
        }
        // иссушение
        const wither_lvl = effects.getEffectLevel(Effect.WITHER);
        if (wither_lvl > 0) {
            this.wither_timer++;
            if (this.wither_timer >= (WITHER_TICKS / (1 << (wither_lvl - 1)))) {
                this.wither_timer = 0;
                damage++;
            }
        } else {
            this.wither_timer = 0;
        }
        // урон от растений
        const isDamagePlanting = (block: TBlock) => {
            const id = block?.id
            return id === bm.CACTUS.id ||
                id === bm.SWEET_BERRY_BUSH.id && block.extra_data?.stage == 3
        }
        const sub = player.state.pos.sub(legsPos);
        if (isDamagePlanting(legs) ||
            isDamagePlanting(legsNeighbours.DOWN) ||
            isDamagePlanting(legsNeighbours.UP) ||
            isDamagePlanting(legsNeighbours.WEST) && sub.x < PLANTING_PADDING_DAMAGE ||
            isDamagePlanting(legsNeighbours.EAST) && sub.x > 1 - PLANTING_PADDING_DAMAGE ||
            isDamagePlanting(legsNeighbours.SOUTH) && sub.z < PLANTING_PADDING_DAMAGE ||
            isDamagePlanting(legsNeighbours.NORTH) && sub.z > 1 - PLANTING_PADDING_DAMAGE
        ) {
            this.planting_lost_timer++;
            if (this.planting_lost_timer >= PLANTING_LOST_TICKS) {
                this.planting_lost_timer = 0;
                damage++;
            }
        } else {
            this.planting_lost_timer = PLANTING_LOST_TICKS;
        }
        // моментальный урон
        const instant_damage_lvl = effects.getEffectLevel(Effect.INSTANT_DAMAGE);
        if (instant_damage_lvl > 0) {
            this.instant_damage_timer++;
            if (this.instant_damage_timer >= INSTANT_DAMAGE_TICKS) {
                this.instant_damage_timer = 0;
                damage += 3 * (1 << (instant_damage_lvl - 1));
            }
        } else {
            this.instant_damage_timer = INSTANT_DAMAGE_TICKS;
        }
        // исцеление
        const instant_health_lvl = effects.getEffectLevel(Effect.INSTANT_HEALTH);
        if (instant_health_lvl > 0) {
            this.instant_health_timer++;
            if (this.instant_health_timer >= INSTANT_HEALTH_TICKS) {
                this.instant_health_timer = 0;
                player.live_level = Math.min(player.live_level + (1 << instant_health_lvl), max_live);
            }
        } else {
            this.instant_health_timer = INSTANT_HEALTH_TICKS;
        }
        // регенерация жизней
        const reg_lvl = effects.getEffectLevel(Effect.REGENERATION);
        if (reg_lvl > 0) {
            this.live_regen_timer++;
            if (this.live_regen_timer >= (LIVE_REGENERATION_TICKS / (1 << (reg_lvl - 1)))) {
                this.live_regen_timer = 0;
                player.live_level = Math.min(player.live_level + 1, max_live);
            }
        } else {
            this.live_regen_timer = 0;
        }
        // сопротивление магическому и физическому урону
        const res_lvl = effects.getEffectLevel(Effect.RESISTANCE)
        damage -= damage * res_lvl * 0.2
        // армор
        const armor_level = this.player.inventory.getArmorLevel()
        if (armor_level > 0 && damage > 0) {
            this.player.inventory.setArmorDecrement()
        }
        damage = Math.round((damage * (MAX_DAMAGE_ABSORPTION - armor_level)) / MAX_DAMAGE_ABSORPTION)
        if (damage > 0) {
            if (this.actor && [EnumDamage.CRIT, EnumDamage.SNOWBALL].includes(this.type_damage)) {
                const pos = this.actor?.state?.pos ? this.actor.state.pos : this.actor.pos
                const velocity = player.state.pos.sub(pos).normSelf()
                velocity.y = .2
                player.controlManager.prismarine.player_state.vel.addSelf(velocity)
            }
            player.live_level = Math.max(player.live_level - damage, 0)
        }
        this.damage = 0

        // если player умер, то обнуляем состояния
        if (player.live_level <= 0) {
            this.#timer_fire = 0
        }

        // анимация горения
        this.player.state.fire = (this.#timer_fire > 0) ? true : false
    }

    /*
    * Нанесение урона игроку
    */
    addDamage(val : number, type_damage? : EnumDamage, actor?) {
        const player = this.player
        if(player.status !== PLAYER_STATUS.ALIVE || !player.game_mode.mayGetDamaged() ||
            player.timer_immunity + IMMUNITY_DAMAGE_TIME >= performance.now()
        ) {
            return false
        }
        this.type_damage = type_damage
        this.actor = actor
        this.damage = val
        return true
    }

    /*
    * добавления истощения
    * exhaustion - уровень истощения
    */
    addExhaustion(exhaustion) {
        this.food_exhaustion_level = Math.min(this.food_exhaustion_level + exhaustion, 40);
    }

    /*
    * установка сытости и насыщения
    * food - уровень еды
    * saturation - уровень насыщения
    */
    setFoodLevel(food: number, saturation: number) {
        const player = this.player;
        const ind_def = player.world.defaultPlayerIndicators;
        player.food_level = Math.min(food + player.food_level, ind_def.food);
        this.food_saturation_level = Math.min(this.food_saturation_level + food * saturation * 2, ind_def.food);
    }

    restoreAll() {
        const player = this.player;
        const ind_def = player.world.defaultPlayerIndicators;
        player.live_level   = ind_def.live;
        player.food_level   = ind_def.food;
        player.oxygen_level = ind_def.oxygen;
        this.#last_height = -Infinity
    }
}