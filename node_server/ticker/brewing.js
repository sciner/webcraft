import {BLOCK} from "../../www/js/blocks.js";
import {ServerClient} from "../../www/js/server_client.js";

const recipes = [
    {
        'product': BLOCK.NETHER_WART.id,
        'bottle': BLOCK.WATER_BOTTLE.id,
        'result': BLOCK.AWKWARD.id
    },
    
    {
        'product': BLOCK.GLOWSTONE_DUST.id,
        'bottle': BLOCK.SPEED.id,
        'result': BLOCK.SPEED_2.id
    },
    {
        'product': BLOCK.REDSTONE_WIRE.id,
        'bottle': BLOCK.SPEED.id,
        'result': BLOCK['SPEED_+'].id
    },
    {
        'product': BLOCK.BLAZE_POWDER.id,
        'bottle': BLOCK.AWKWARD.id,
        'result': BLOCK.STRENGTH.id
    },
    {
        'product': BLOCK.GLOWSTONE_DUST.id,
        'bottle': BLOCK.STRENGTH.id,
        'result': BLOCK.STRENGTH_2.id
    },
    {
        'product': BLOCK.REDSTONE_WIRE.id,
        'bottle': BLOCK.STRENGTH.id,
        'result': BLOCK['STRENGTH_+'].id
    },
    // прыгучесть
    {
        'product': BLOCK.RABBIT_FOOT.id,
        'bottle': BLOCK.AWKWARD.id,
        'result': BLOCK.JUMP_BOOST.id
    },
    {
        'product': BLOCK.GLOWSTONE_DUST.id,
        'bottle': BLOCK.JUMP_BOOST.id,
        'result': BLOCK.JUMP_BOOST_2.id
    },
    {
        'product': BLOCK.REDSTONE_WIRE.id,
        'bottle': BLOCK.JUMP_BOOST.id,
        'result': BLOCK['JUMP_BOOST_+'].id
    },
    // зелье замедления
    {
        'product': BLOCK.FERMENTED_SPIDER_EYE.id,
        'bottle': BLOCK.JUMP_BOOST.id,
        'result': BLOCK.SLOWNESS.id
    },
    {
        'product': BLOCK.FERMENTED_SPIDER_EYE.id,
        'bottle': BLOCK.SPEED.id,
        'result': BLOCK.SLOWNESS.id
    },
    {
        'product': BLOCK.GLOWSTONE_DUST.id,
        'bottle': BLOCK.SLOWNESS.id,
        'result': BLOCK.SLOWNESS_4.id
    },
    {
        'product': BLOCK.REDSTONE_WIRE.id,
        'bottle': BLOCK.SLOWNESS.id,
        'result': BLOCK['SLOWNESS_+'].id
    },
    // зелье востановления здоровья
    {
        'product': BLOCK.GLISTERING_MELON_SLICE.id,
        'bottle': BLOCK.AWKWARD.id,
        'result': BLOCK.INSTANT_HEALTH.id
    },
    {
        'product': BLOCK.GLOWSTONE_DUST.id,
        'bottle': BLOCK.INSTANT_HEALTH.id,
        'result': BLOCK.INSTANT_HEALTH_2.id
    },
    // зелье урона
    {
        'product': BLOCK.FERMENTED_SPIDER_EYE.id,
        'bottle': BLOCK.INSTANT_HEALTH.id,
        'result': BLOCK.INSTANT_DAMAGE.id
    },
    {
        'product': BLOCK.FERMENTED_SPIDER_EYE.id,
        'bottle': BLOCK.POISON.id,
        'result': BLOCK.INSTANT_DAMAGE.id
    },
    {
        'product': BLOCK.GLOWSTONE_DUST.id,
        'bottle': BLOCK.INSTANT_DAMAGE.id,
        'result': BLOCK.INSTANT_DAMAGE_2.id
    },
    // отравление
    {
        'product': BLOCK.SPIDER_EYE.id,
        'bottle': BLOCK.AWKWARD.id,
        'result': BLOCK.POISON.id
    },
    {
        'product': BLOCK.GLOWSTONE_DUST.id,
        'bottle': BLOCK.POISON.id,
        'result': BLOCK.POISON_2.id
    },
    {
        'product': BLOCK.REDSTONE_WIRE.id,
        'bottle': BLOCK.POISON.id,
        'result': BLOCK['POISON_+'].id
    },
    // регенерация здоровья
    {
        'product': BLOCK.GHAST_TEAR.id,
        'bottle': BLOCK.AWKWARD.id,
        'result': BLOCK.REGENERATION.id
    },
    {
        'product': BLOCK.GLOWSTONE_DUST.id,
        'bottle': BLOCK.REGENERATION.id,
        'result': BLOCK.REGENERATION_2.id
    },
    {
        'product': BLOCK.REDSTONE_WIRE.id,
        'bottle': BLOCK.REGENERATION.id,
        'result': BLOCK['REGENERATION_+'].id
    },
    // огнестойкость
    {
        'product': BLOCK.MAGMA_CREAM.id,
        'bottle': BLOCK.AWKWARD.id,
        'result': BLOCK.FIRE_RESISTANCE.id
    },
    {
        'product': BLOCK.REDSTONE_WIRE.id,
        'bottle': BLOCK.REGENERATION.id,
        'result': BLOCK['FIRE_RESISTANCE_+'].id
    },
    // подводное дыхание
    {
        'product': BLOCK.PUFFERFISH.id,
        'bottle': BLOCK.AWKWARD.id,
        'result': BLOCK.RESPIRATION.id
    },
    {
        'product': BLOCK.REDSTONE_WIRE.id,
        'bottle': BLOCK.RESPIRATION.id,
        'result': BLOCK['RESPIRATION_+'].id
    },
];

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
    static func(tick_number, world, chunk, v) {
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
            if(blaze_slot && blaze_slot.id == BLOCK.BLAZE_POWDER.id) {
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
            world.chests.sendChestToPlayers(v.pos.clone(), []);
        }
        return updated_blocks;
        /*const max_ticks = 50;
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        if(!extra_data || !extra_data.slots) {
            return;
        }
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
        if(state.fuel_time == 0) {
            const fuel_slot = extra_data.slots[1];
            if(fuel_slot) {
                const fuel_mat = BLOCK.fromId(fuel_slot.id);
                if(fuel_mat.fuel_time) {
                    const add_fuel_ticks = fuel_mat.fuel_time * 20;
                    state.max_time = state.fuel_time = add_fuel_ticks;
                    is_update = true;
                    fuel_slot.count--;
                    console.log('* fuel added for furnace:', add_fuel_ticks, fuel_slot.count);
                    if(fuel_slot.count == 0) {
                        delete(extra_data.slots[1]);
                    }
                }
            }
        }
        // cook
        let coocked = false;
        let fuel_used = false;
        let product_slot = extra_data.slots[0];
        if(state.fuel_time > 0) {
            let result_slot = extra_data.slots[2];
            if(product_slot && product_slot.count > 0) {
                const product_mat = BLOCK.fromId(product_slot.id);
                // check if ore
                if(product_mat.coocked_item) {
                    const add_count = product_mat.coocked_item.count;
                    const coocked_mat = BLOCK.fromName(product_mat.coocked_item.name); 
                    // compare ore result id and result slot mat id
                    if(!result_slot || result_slot.id == coocked_mat.id) {
                        state.result_ticks++;
                        const tick = state.result_ticks % max_ticks == 0;
                        if(!result_slot) {
                            if(tick) {
                                extra_data.slots[2] = {
                                    id: coocked_mat.id,
                                    count: add_count
                                };
                                coocked = true;
                            }
                        } else if (result_slot.count + add_count <= coocked_mat.max_in_stack) {
                            if(tick) {
                                result_slot.count += add_count;
                                coocked = true;
                            }
                        } else {
                            return updated_blocks;
                        }
                        fuel_used = true;
                        is_update = ((state.fuel_time - 1) % 2) == 0;
                    }
                }
            }
        }
        if(fuel_used) {
            state.fuel_time--;
            // console.log('* furnace fuel--');
        } else {
            let elapsed = state.result_ticks % max_ticks;
            if(elapsed > 0) {
                state.result_ticks--;
                is_update = state.result_ticks % 2 == 0;
            }
        }
        //
        const active_o = extra_data.active;
        extra_data.active = state.fuel_time > 0;
        if(extra_data.active != active_o) {
            is_update = true;
        }
        //
        state.result_percent = (state.result_ticks % max_ticks) / max_ticks;
        // списание переработанного ресурса
        if(coocked) {
            product_slot.count--;
            if(product_slot.count == 0) {
                delete(extra_data.slots[0]);
            }
            is_update = true;
            console.log(`* furnace coocked!`);
        }
        // если что-то обновилось, то шлём это игрокам
        if(is_update) {
            updated_blocks.push({pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
            world.chests.sendChestToPlayers(v.pos.clone(), []);
        }
        return updated_blocks;*/
    }

}