import {ServerClient} from "@client/server_client.js";
import type { TickingBlockManager } from "../server_chunk.js";

const recipes_src = [
    {
        'product': 'NETHER_WART',
        'bottle': 'WATER_BOTTLE',
        'result': 'AWKWARD'
    },

    {
        'product': 'GLOWSTONE_DUST',
        'bottle': 'SPEED',
        'result': 'SPEED_2'
    },
    {
        'product': 'REDSTONE_WIRE',
        'bottle': 'SPEED',
        'result': 'SPEED_+'
    },
    {
        'product': 'BLAZE_POWDER',
        'bottle': 'AWKWARD',
        'result': 'STRENGTH'
    },
    {
        'product': 'GLOWSTONE_DUST',
        'bottle': 'STRENGTH',
        'result': 'STRENGTH_2'
    },
    {
        'product': 'REDSTONE_WIRE',
        'bottle': 'STRENGTH',
        'result': 'STRENGTH_+'
    },
    // прыгучесть
    {
        'product': 'RABBIT_FOOT',
        'bottle': 'AWKWARD',
        'result': 'JUMP_BOOST'
    },
    {
        'product': 'GLOWSTONE_DUST',
        'bottle': 'JUMP_BOOST',
        'result': 'JUMP_BOOST_2'
    },
    {
        'product': 'REDSTONE_WIRE',
        'bottle': 'JUMP_BOOST',
        'result': 'JUMP_BOOST_+'
    },
    // зелье замедления
    {
        'product': 'FERMENTED_SPIDER_EYE',
        'bottle': 'JUMP_BOOST',
        'result': 'SLOWNESS'
    },
    {
        'product': 'FERMENTED_SPIDER_EYE',
        'bottle': 'SPEED',
        'result': 'SLOWNESS'
    },
    {
        'product': 'GLOWSTONE_DUST',
        'bottle': 'SLOWNESS',
        'result': 'SLOWNESS_4'
    },
    {
        'product': 'REDSTONE_WIRE',
        'bottle': 'SLOWNESS',
        'result': 'SLOWNESS_+'
    },
    // зелье востановления здоровья
    {
        'product': 'GLISTERING_MELON_SLICE',
        'bottle': 'AWKWARD',
        'result': 'INSTANT_HEALTH'
    },
    {
        'product': 'GLOWSTONE_DUST',
        'bottle': 'INSTANT_HEALTH',
        'result': 'INSTANT_HEALTH_2'
    },
    // зелье урона
    {
        'product': 'FERMENTED_SPIDER_EYE',
        'bottle': 'INSTANT_HEALTH',
        'result': 'INSTANT_DAMAGE'
    },
    {
        'product': 'FERMENTED_SPIDER_EYE',
        'bottle': 'POISON',
        'result': 'INSTANT_DAMAGE'
    },
    {
        'product': 'GLOWSTONE_DUST',
        'bottle': 'INSTANT_DAMAGE',
        'result': 'INSTANT_DAMAGE_2'
    },
    // отравление
    {
        'product': 'SPIDER_EYE',
        'bottle': 'AWKWARD',
        'result': 'POISON'
    },
    {
        'product': 'GLOWSTONE_DUST',
        'bottle': 'POISON',
        'result': 'POISON_2'
    },
    {
        'product': 'REDSTONE_WIRE',
        'bottle': 'POISON',
        'result': 'POISON_+'
    },
    // регенерация здоровья
    {
        'product': 'GHAST_TEAR',
        'bottle': 'AWKWARD',
        'result': 'REGENERATION'
    },
    {
        'product': 'GLOWSTONE_DUST',
        'bottle': 'REGENERATION',
        'result': 'REGENERATION_2'
    },
    {
        'product': 'REDSTONE_WIRE',
        'bottle': 'REGENERATION',
        'result': 'REGENERATION_+'
    },
    // огнестойкость
    {
        'product': 'MAGMA_CREAM',
        'bottle': 'AWKWARD',
        'result': 'FIRE_RESISTANCE'
    },
    {
        'product': 'REDSTONE_WIRE',
        'bottle': 'REGENERATION',
        'result': 'FIRE_RESISTANCE_+'
    },
    // подводное дыхание
    {
        'product': 'PUFFERFISH',
        'bottle': 'AWKWARD',
        'result': 'RESPIRATION'
    },
    {
        'product': 'REDSTONE_WIRE',
        'bottle': 'RESPIRATION',
        'result': 'RESPIRATION_+'
    },
    // ночное зрение
    {
        'product': 'GOLDEN_CARROT',
        'bottle': 'AWKWARD',
        'result': 'NIGHT_VISION'
    },
    {
        'product': 'REDSTONE_WIRE',
        'bottle': 'NIGHT_VISION',
        'result': 'NIGHT_VISION_+'
    },
]
const recipes = []

function getResult(product, bottle) {
    if (!product || !bottle) {
        return null;
    }
    for (const recipe of recipes) {
        if (recipe.product == product.id && recipe.bottle == bottle.id) {
            return recipe.result;
        }
    }
    return null;
}

export default class Ticker {

    static type = 'brewing'

    //
    static func(this: TickingBlockManager, tick_number, world, chunk, v) {

        const bm = world.block_manager;
        if(recipes.length == 0) {
            for(let src of recipes_src) {
                const item = {
                    product: bm.fromName(src.product).id,
                    bottle: bm.fromName(src.bottle).id,
                    result: bm.fromName(src.result).id
                }
                recipes.push(item)
            }
        }

        const max_ticks = 50;
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        // fuel
        if(!('state' in extra_data)) {
            extra_data.state = {};
        }
        if(!('active' in extra_data)) {
            extra_data.active = false;
        }
        const state = extra_data.state;
        let is_update = false;
        if(!('fuel_time' in state)) {
            state.fuel_time = 0;
            state.result_ticks = 0;
            state.result_percent = 0;
        }
        const blaze_slot = extra_data.slots[0]; //blaze
        if(state.fuel_time == 0) {
            const ing_slot = extra_data.slots[1]; //ингридиенты
            if(blaze_slot && blaze_slot.id == bm.BLAZE_POWDER.id) {
                const add_fuel_ticks = 80 * 20;
                state.max_time = state.fuel_time = add_fuel_ticks;
                is_update = true;
                blaze_slot.count--;
                if(blaze_slot.count == 0) {
                    delete(extra_data.slots[0]);
                }
            }
        }
        const product_slot = extra_data.slots[1];
        const bottle_one_slot = extra_data.slots[2];
        const bottle_two_slot = extra_data.slots[3];
        const bottle_three_slot = extra_data.slots[4];
        let fuel_used = false;
        let coocked = false;
        // проверка общего случая
        if(state.fuel_time > 0 && product_slot && product_slot.count > 0 && (bottle_one_slot || bottle_two_slot || bottle_three_slot)) {
            // подходит ли ингридиент для крафта
            const result_one_slot = getResult(product_slot, bottle_one_slot);
            const result_two_slot = getResult(product_slot, bottle_two_slot);
            const result_three_slot = getResult(product_slot, bottle_three_slot);
            if (result_one_slot || result_two_slot || result_three_slot) {
                state.result_ticks++;
                const tick = state.result_ticks % max_ticks == 0;
                if(tick) {
                    if (result_one_slot) {
                        extra_data.slots[2] = {id: result_one_slot, count: 1};
                    }
                    if (result_two_slot) {
                        extra_data.slots[3] = {id: result_two_slot, count: 1};
                    }
                    if (result_two_slot) {
                        extra_data.slots[4] = {id: result_three_slot, count: 1};
                    }
                    coocked = true;
                }
                fuel_used = true;
                is_update = ((state.fuel_time - 1) % 2) == 0;
            }
        }

        if(fuel_used) {
            state.fuel_time--;
        } else {
            const elapsed = state.result_ticks % max_ticks;
            if(elapsed > 0) {
                state.result_ticks--;
                is_update = state.result_ticks % 2 == 0;
            }
        }
        if(coocked) {
            product_slot.count--;
            if(product_slot.count == 0) {
                delete(extra_data.slots[1]);
            }
            is_update = true;
        }

        state.result_percent = (state.result_ticks % max_ticks) / max_ticks;
        // если что-то обновилось, то шлём это игрокам
        const updated_blocks = [];
        if(is_update) {
            updated_blocks.push({pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
            world.chests.sendChestToPlayers(tblock, null);
        }
        return updated_blocks;
    }

}