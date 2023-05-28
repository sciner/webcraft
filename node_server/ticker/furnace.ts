import {BLOCK} from "@client/blocks.js";
import type { TickingBlockManager } from "../server_chunk.js";

export default class Ticker {

    static type = 'furnace'

    //
    static func(this: TickingBlockManager, tick_number, world, chunk, v) {
        const max_ticks = 50;
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
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
        //
        const product_slot = extra_data.slots[0]
        // Check if need fuel
        const checkNeedFuel = () => {
            if(product_slot && product_slot.count > 0) {
                const product_mat = BLOCK.fromId(product_slot.id);
                return !product_mat.is_dummy && product_mat.coocked_item && state.fuel_time == 0
            }
            return false
        }
        //
        if(checkNeedFuel()) {
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
                            return null;
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
            world.saveSendExtraData(tblock)
        }
        return null
    }

}