import {Helpers, Vector} from "./helpers.js";
import { INVENTORY_SLOT_COUNT, INVENTORY_VISIBLE_SLOT_COUNT, INVENTORY_HOTBAR_SLOT_COUNT } from "./constant.js";

export class Inventory {

    temp_vec = new Vector();

    constructor(player, state) {
        this.count              = state.items.length;
        this.player             = player;
        this.block_manager      = player.world.block_manager;
        this.current            = state.current;
        this.items              = new Array(this.count); // state.items;
        this.max_count          = INVENTORY_SLOT_COUNT;
        this.max_visible_count  = INVENTORY_VISIBLE_SLOT_COUNT;
        this.hotbar_count       = INVENTORY_HOTBAR_SLOT_COUNT;
        this.onSelect           = (item) => {};
        this.applyNewItems(state.items, false);
    }

    //
    setIndexes(data, send_state) {
        this.current.index = Helpers.clamp(data.index, 0, this.hotbar_count - 1);
        this.current.index2 = Helpers.clamp(data.index2, -1, this.max_visible_count - 1);
        this.refresh(send_state);
    }

    //
    applyNewItems(items, refresh) {
        if(!Array.isArray(items)) {
            throw 'error_items_must_be_array';
        }
        if(items.length != this.count) {
            throw 'error_items_invalid_count|' + `${items.length} != ${this.count}`;
        }
        const new_items = [];
        for(let i in items) {
            let b = null;
            if(items[i]) {
                b = this.block_manager.fromId(items[i].id)
            }
            new_items[i] = this.block_manager.convertItemToInventoryItem(items[i], b);
        }
        this.items = new_items;
        if(refresh) {
            this.refresh(true);
        }
    }

    // Return current active item in hotbar
    get current_item() {
        return this.items[this.current.index];
    }

    //
    select(index) {
        if(index < 0) {
            index = this.hotbar_count - 1;
        }
        if(index >= this.hotbar_count) {
            index = 0;
        }
        this.current.index = index;
        this.refresh(true);
        this.onSelect(this.current_item);
    }

    // Increment
    increment(mat, no_update_if_remains) {
        if(!mat.id) {
            throw 'error_empty_block_id';
        }
        mat.id = parseInt(mat.id);
        mat.count = parseInt(mat.count);
        if(mat.count < 1) {
            throw 'error_increment_value_less_then_one';
        }
        const block = this.block_manager.fromId(mat.id);
        if(!block) {
            throw 'error_invalid_block_id';
        }
        no_update_if_remains = !!no_update_if_remains;
        mat = this.block_manager.convertItemToInventoryItem(mat);
        //
        const updated = new Map();
        const added = new Map();
        const item_max_count = block.max_in_stack;
        // 1. update cell if exists
        let need_refresh = false;
        if(!mat.entity_id) {
            for(let i in this.items) {
                const item = this.items[i];
                if(item) {
                    if(item.id == mat.id && item?.entity_id == null && item?.extra_data == null) {
                        if(item.count < item_max_count) {
                            if(item.count + mat.count <= item_max_count) {
                                updated.set(i, Math.min(item.count + mat.count, item_max_count));
                                mat.count = 0;
                                need_refresh = true;
                                break;
                            } else {
                                mat.count = (item.count + mat.count) - item_max_count;
                                updated.set(i, item_max_count);
                                need_refresh = true;
                            }
                        }
                    }
                }
            }
        }
        // 2. start new slot
        if(mat.count > 0) {
            for(let i = 0; i < this.max_visible_count; i++) {
                if(!this.items[i]) {
                    const new_clot = {...mat};
                    added.set(i, new_clot);
                    need_refresh = true;
                    if(new_clot.count > item_max_count) {
                        mat.count -= item_max_count;
                        new_clot.count = item_max_count;
                    } else {
                        mat.count = 0;
                        break;
                    }
                }
            }
        }
        // no update if remains
        if(no_update_if_remains && mat.count > 0) {
            return false;
        }
        if(need_refresh) {
            // updated
            for(let [i, count] of updated.entries()) {
                i = parseInt(i);
                this.items[i | 0].count = count;
            }
            // added
            let select_index = -1;
            for(let [i, item] of added.entries()) {
                i = parseInt(i);
                this.items[i] = item;
                if(i == this.current.index) {
                    select_index = i;
                }
            }
            if(select_index >= 0) {
                this.select(select_index);
                return true;
            }
            return this.refresh(true);
        }
        return false;
    }

    //
    decrement_instrument(mined_block) {
        if(!this.current_item || this.player.game_mode.isCreative()) {
            return;
        }
        const current_item_material = this.block_manager.fromId(this.current_item.id);
        if(current_item_material.item?.instrument_id) {
            this.current_item.power = Math.max(this.current_item.power - 1, 0);
            if(this.current_item.power <= 0) {
                this.items[this.current.index] = null;
            }
            this.refresh(true);
        }
    }

    // Decrement
    decrement(decrement_item, ignore_creative_game_mode) {
        if(!this.current_item) {
            return;
        }
        if(!ignore_creative_game_mode && this.player.game_mode.isCreative()) {
            return;
        }
        const current_item_material = this.block_manager.fromId(this.current_item.id);
        if(current_item_material.item?.instrument_id) {
            this.decrement_instrument();
        } else {
            this.current_item.count = Math.max(this.current_item.count - 1, 0);
            if(this.current_item.count < 1) {
                let matBlock = this.block_manager.fromId(this.current_item.id);
                if(matBlock.item && matBlock.item?.name == 'bucket') {
                    if(matBlock.item.emit_on_set) {
                        const emptyBucket = this.block_manager.BUCKET;
                        this.items[this.current.index] = {id: emptyBucket.id, count: 1};
                    }
                } else {
                    this.items[this.current.index] = null;
                }
            }
        }
        this.refresh(true);
    }

    // Decrement extended (ver. 2)
    decrementExtended(params) {
        if(!this.current_item) {
            return;
        }
        if(!params.ignore_creative_game_mode && this.player.game_mode.isCreative()) {
            return;
        }
        const current_item_material = this.block_manager.fromId(this.current_item.id);
        const count_mode = params.mode == 'count';
        if(!count_mode && current_item_material.item?.instrument_id) {
            this.decrement_instrument();
        } else {
            this.current_item.count = Math.max(this.current_item.count - 1, 0);
            if(this.current_item.count < 1) {
                if(!count_mode && current_item_material.item && current_item_material.item?.name == 'bucket') {
                    if(current_item_material.item.emit_on_set) {
                        const emptyBucket = this.block_manager.BUCKET;
                        this.items[this.current.index] = {id: emptyBucket.id, count: 1};
                    }
                } else {
                    this.items[this.current.index] = null;
                }
            }
        }
        this.refresh(true);
    }

    // decrementByItemID
    decrementByItemID(item_id, count, dont_refresh) {
        for(let i in this.items) {
            let item = this.items[i];
            if(!item || item.count < 1) {
                continue;
            }
            if(item.id == item_id) {
                if(item.count >= count) {
                    item.count -= count;
                    if(item.count < 1) {
                        this.items[i] = null;
                    }
                    break;
                } else {
                    count -= item.count;
                    item.count = 0;
                    this.items[i] = null;
                }
            }
        }
        if(typeof dont_refresh === 'undefined' || !dont_refresh) {
            this.refresh(true);
        }
    }

    // Возвращает список того, чего и в каком количестве не хватает
    // в текущем инвентаре по указанному списку
    hasResources(resources) {
        let resp = [];
        for(let resource of resources) {
            let r = {
                item_id: resource.item_id,
                count: resource.count
            };
            // Each all items in inventoryy
            for(var item of this.items) {
                if(!item) {
                    continue;
                }
                if(item.id == r.item_id) {
                    if(item.count > r.count) {
                        r.count = 0;
                    } else {
                        r.count -= item.count;
                    }
                    if(r.count == 0) {
                        break;
                    }
                }
            }
            if(r.count > 0) {
                resp.push(r);
            }
        }
        return resp;
    }

    // Return items from inventory
    exportItems() {
        const resp = {
            current: {
                index: this.current.index,
                index2: this.current.index2
            },
            items: this.items
        }
        return resp;
    }

    getLeftIndex() {
        return this.current.index2;
    }

    getRightIndex() {
        return this.current.index;
    }

    //
    setItem(index, item) {
        this.items[index] = item;
        // Обновить текущий инструмент у игрока
        this.select(this.current.index);
    }

    next() {
        this.select(++this.current.index);
    }

    prev() {
        this.select(--this.current.index);
    }

    /*
    // Has item
    hasItem(item) {
        if(!item || !('id' in item) || !('count' in item)) {
            return false;
        }
        //
        const item_col = InventoryComparator.groupToSimpleItems([item]);
        if(item_col.size != 1) {
            return false;
        }
        const item_key = item_col.keys().next()?.value;
        item = item_col.get(item_key);
        //
        const items = InventoryComparator.groupToSimpleItems(this.items);
        const existing_item = items.get(item_key);
        return existing_item && existing_item.count >= item.count;
    }*/

    /*
    // Decrement item
    decrementItem(item) {
        if(!item || !('id' in item) || !('count' in item)) {
            return false;
        }
        //
        const item_col = InventoryComparator.groupToSimpleItems([item]);
        if(item_col.size != 1) {
            return false;
        }
        const item_key = item_col.keys().next()?.value;
        item = item_col.get(item_key);
        //
        const items = InventoryComparator.groupToSimpleItems(this.items);
        const existing_item = items.get(item_key);
        if(!existing_item || existing_item.count < item.count) {
            return false;
        }
        // Decrement
        if(isNaN(item_key)) {
            // @todo Нужно по другому сделать вычитание, иначе если игрок не запросит свою постройку айтемов, на сервере у него порядок и группировка останется неправильной
            // Я сделал так, потому что математически у него останется правильное количество айтемов и меня это пока устраивает =)
            existing_item.count -= item.count;
            if(existing_item.count < 1) {
                items.delete(item_key);
            }
            this.items = Array.from(items.values());
        } else {
            this.decrementByItemID(item.id, item.count, true);
        }
        return true;
    }*/

}