import {BLOCK} from "../../www/js/blocks.js";
import {ServerClient} from "../../www/js/server_client.js";

export default class Ticker {

    static type = 'furnace'

    //
    static async func(world, chunk, v) {
        const max_ticks = 50;
        const tblock = v.tblock;
        // const ticking = v.ticking;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        if(!extra_data || !extra_data.slots) {
            return;
        }
        // fuel
        if(!('state' in extra_data)) {
            extra_data.state = {};
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
        state.result_percent = (state.result_ticks % max_ticks) / max_ticks;
        const prev_id = tblock.id;
        tblock.id = ((state.result_ticks % max_ticks) > 0 || coocked) ? 62 : 61;
        if(!is_update) {
            is_update = tblock.id != prev_id;
        }
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
        return updated_blocks;
    }

}