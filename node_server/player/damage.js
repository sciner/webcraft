import { Effect } from "./effects.js";
import { BLOCK } from "../../www/js/blocks.js";

const LIVE_REGENERATIN_TICKS = 50;
const FIRE_LOST_TICKS = 10;
const OXYGEN_LOST_TICKS = 10;
const OXYGEN_GOT_TICKS = 5;
const POISON_TICKS = 25;
const WITHER_TICKS = 40;
const FOOD_LOST_TICKS = 80;

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
    }
    
    /*
    * Метод выдает колличестов урона
    *
    */
    getDamage(tick) {
        const player = this.player;
        const world = player.world;
        const effects = player.effects;
        const head = world.getBlock(player.getEyePos().floored());
        const legs = world.getBlock(player.state.pos.floored());
        const ind_def = world.getDefaultPlayerIndicators();
        
        let max_live = ind_def.live.value;
        // эффект прилив здоровья
        const health_boost_lvl = effects.getEffectLevel(Effect.HEALTH_BOOST);
        max_live += 2 * health_boost_lvl;
        
        let damage = 0;
        // поставил сюда, так как она тоже дает демаг
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
        
        
        // урон он воды и удушения
        if (!head.material.has_oxygen) {
            this.oxygen_got_timer = 0;
            this.oxygen_lost_timer++;
            if (this.oxygen_lost_timer >= OXYGEN_LOST_TICKS) {
                this.oxygen_lost_timer = 0;
                // эффект подводное дыхание
                const level = effects.getEffectLevel(Effect.RESPIRATION);
                const rnd = (Math.random() * (level + 1)) | 0;
                if (level == 0 || rnd == 0) {
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
        
        // огонь с эффектом защиты от огня
        const fire_res_lvl = effects.getEffectLevel(Effect.FIRE_RESISTANCE);
        if (legs.id == BLOCK.FIRE.id || legs.id == BLOCK.CAMPFIRE.id) {
            this.fire_lost_timer++;
            if (this.fire_lost_timer >= FIRE_LOST_TICKS) {
                this.fire_lost_timer = 0;
                if (fire_res_lvl == 0) {
                    damage++;
                }
            }
        } else {
            this.fire_lost_timer = 0;
        }
        
        // отравление
        const poison_lvl = effects.getEffectLevel(Effect.POISON);
        if (poison_lvl > 0) {
            this.poison_timer++;
            if (this.posion_timer >= (POISON_TICKS / (2**(poison_lvl - 1)))) {
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
    
   /* tick(delta, tick_number) {
        const player = this.player;
        const world = player.world;
        const params = {
            tick_number,
            tblocks: {
                head: world.getBlock(player.getEyePos().floored()),
                legs: world.getBlock(player.state.pos.floored())
            }
        }
        // Утопление + удушение
        this.checkLackOfOxygenAndAsphyxiation(params);
    }

    // Check lack of oxygen and asphyxiation
    checkLackOfOxygenAndAsphyxiation(params) {
        const player = this.player;
        const world = player.world;
        if(player.is_dead || !player.game_mode.getCurrent().asphyxiation) {
            return false;
        }
        const LOST_TICKS = 10;
        const GOT_TICKS = 5;
        if(((params.tick_number % LOST_TICKS) != 0) && (params.tick_number % GOT_TICKS) != 0) {
            return false;
        }
        const ind_def = world.getDefaultPlayerIndicators().oxygen;
        const ind_player = player.state.indicators[ind_def.name];
        const mat = params.tblocks.head.material;
        if(mat.has_oxygen) {
            if((params.tick_number % GOT_TICKS) == 0) {
                if(ind_player.value < ind_def.value) {
                    player.changeIndicator(ind_def.name, 1)
                }
            }
        } else {
            if((params.tick_number % LOST_TICKS) == 0) {
                if(ind_player.value > 0) {
                    player.changeIndicator(ind_def.name, -1);
                } else {
                    player.changeIndicator('live', -1);
                    if(player.state.indicators.live.value % 2 == 1) {
                        this.sendDamageSound('hit');
                    }
                }
            }
        }
    }

    sendDamageSound(action) {
        const packets = [{
            name: ServerClient.CMD_PLAY_SOUND,
            data: { tag: 'madcraft:block.player', action: action, pos: null}
        }];
        this.player.world.sendSelected(packets, [this.player.session.user_id]);
    }*/

}