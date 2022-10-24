import { Effect } from "../../www/js/block_type/effect.js";
import { BLOCK } from "../../www/js/blocks.js";
import { Vector } from "../../www/js/helpers.js";

const INSTANT_DAMAGE_TICKS = 10;
const INSTANT_HEALTH_TICKS = 10;
const LIVE_REGENERATIN_TICKS = 50;
const FIRE_LOST_TICKS = 10;
const OXYGEN_LOST_TICKS = 10;
const OXYGEN_GOT_TICKS = 5;
const POISON_TICKS = 25;
const WITHER_TICKS = 40;
const FOOD_LOST_TICKS = 80;
const CACTUS_LOST_TICKS = 10;
const CACTUS_PADDING_DAMAGE = 0.3;

export class ServerPlayerDamage {
    
    constructor(player) {
        this.player = player;
        this.oxygen_lost_timer = 0;
        this.oxygen_got_timer = 0;
        this.fire_lost_timer = 0;
        this.live_regen_timer = 0;
        this.poison_timer = 0;
        this.wither_timer = 0;
        this.food_timer = 0;
        this.food_saturation_level = 0;
        this.food_exhaustion_level = 0;
        this.cactus_lost_timer = 0;
        this.instant_health_timer = 0;
        this.instant_damage_timer = 0;
    }
    
    /*
    * Метод подсчитывает колличество урона
    *
    */
    getDamage(tick) {
        const player = this.player;
        const world = player.world;
        const effects = player.effects;
        const position = player.state.pos.floored();
        const head = world.getBlock(player.getEyePos().floored());
        const legs = world.getBlock(position);
        const ind_def = world.getDefaultPlayerIndicators();
        
        let max_live = ind_def.live.value;
        // эффект прилив здоровья
        const health_boost_lvl = effects.getEffectLevel(Effect.HEALTH_BOOST);
        max_live += 2 * health_boost_lvl;
        
        let damage = 0;
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
        
        // урон он воды и удушения эффект подводное дыхание
        if (!head.has_oxygen) {
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
                player.oxygen_level =  Math.min(player.oxygen_level + 1, ind_def.oxygen.value);
            }
        }
        
        // огонь/лава с эффектом защиты от огня
        if (legs.id == BLOCK.FIRE.id || legs.id == BLOCK.CAMPFIRE.id || legs.material.material.id == 'lava') {
            this.fire_lost_timer++;
            if (this.fire_lost_timer >= FIRE_LOST_TICKS) {
                this.fire_lost_timer = 0;
                const fire_res_lvl = effects.getEffectLevel(Effect.FIRE_RESISTANCE);
                if (fire_res_lvl == 0) {
                    damage = (legs.material.material.id == 'lava') ? damage + 4 : damage + 1;
                }
            }
        } else {
            this.fire_lost_timer = FIRE_LOST_TICKS;
        }
        
        // отравление
        const poison_lvl = effects.getEffectLevel(Effect.POISON);
        if (poison_lvl > 0) {
            this.poison_timer++;
            if (this.poison_timer >= (POISON_TICKS / (2**(poison_lvl - 1)))) {
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
            if (this.wither_timer >= (WITHER_TICKS / (2**(wither_lvl - 1)))) {
                this.wither_timer = 0;
                damage++;
            }
        } else {
            this.wither_timer = 0;
        }
        
        // урон от кактуса
        const east = world.getBlock(position.add(Vector.XN));
        const west = world.getBlock(position.add(Vector.XP));
        const north = world.getBlock(position.add(Vector.ZP));
        const south = world.getBlock(position.add(Vector.ZN));
        const down = world.getBlock(position.add(Vector.YN));
        const sub = player.state.pos.sub(position);
        if  ((down.id == BLOCK.CACTUS.id) || (east.id == BLOCK.CACTUS.id && sub.x < CACTUS_PADDING_DAMAGE) || (west.id == BLOCK.CACTUS.id && sub.x > 1.0 - CACTUS_PADDING_DAMAGE) || (south.id == BLOCK.CACTUS.id && sub.z < CACTUS_PADDING_DAMAGE) || (north.id == BLOCK.CACTUS.id && sub.z > 1 - CACTUS_PADDING_DAMAGE)) {
            this.cactus_lost_timer++;
            if (this.cactus_lost_timer >= CACTUS_LOST_TICKS) {
                this.cactus_lost_timer = 0;
                damage++;
            }
        } else {
            this.cactus_lost_timer = CACTUS_LOST_TICKS;
        }
        
        // моментальный урон
        const instant_damage_lvl = effects.getEffectLevel(Effect.INSTANT_DAMAGE);
        if (instant_damage_lvl > 0) {
            this.instant_damage_timer++;
            if (this.instant_damage_timer >= INSTANT_DAMAGE_TICKS) {
                this.instant_damage_timer = 0;
                damage += 3 * (2**(instant_damage_lvl - 1));
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
                player.live_level = Math.min(player.live_level + 2**instant_health_lvl, max_live);
            }
        } else {
            this.instant_health_timer = INSTANT_HEALTH_TICKS;
        }
        
        // регенерация жизней
        const reg_lvl = effects.getEffectLevel(Effect.REGENERATION);
        if (reg_lvl > 0) {
            this.live_regen_timer++;
            if (this.live_regen_timer >= (LIVE_REGENERATIN_TICKS / (2**(reg_lvl - 1)))) {
                this.live_regen_timer = 0;
                player.live_level = Math.min(player.live_level + 1, max_live);
            }
        } else {
            this.live_regen_timer = 0;
        }
        
        // сопротивление магическому и физическому урону
        const res_lvl = effects.getEffectLevel(Effect.RESISTANCE);
        damage = Math.round(damage - damage * res_lvl * 0.2);
        if (damage > 0) {
            player.live_level = Math.max(player.live_level - damage, 0);
        }
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
    setFoodLevel(food, saturation) {
        const player = this.player;
        const ind_def = player.world.getDefaultPlayerIndicators();
        player.food_level = Math.min(food + player.food_level, ind_def.food.value);
        this.food_saturation_level = Math.min(this.food_saturation_level + food * saturation * 2, ind_def.food.value);
    }
    
}