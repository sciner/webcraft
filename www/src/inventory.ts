import { ArrayOrMap, Helpers, Vector} from "./helpers.js";
import { INVENTORY_SLOT_COUNT, INVENTORY_VISIBLE_SLOT_COUNT,
    INVENTORY_DRAG_SLOT_INDEX, INVENTORY_HOTBAR_SLOT_COUNT, PLAYER_ARMOR_SLOT_HELMET, PLAYER_ARMOR_SLOT_CHESTPLATE, PLAYER_ARMOR_SLOT_LEGGINGS, PLAYER_ARMOR_SLOT_BOOTS } from "./constant.js";
import { BLOCK } from "./blocks.js"
import { InventoryComparator } from "./inventory_comparator.js";
import type { ArmorState, Player } from "./player.js";
import type { CraftTableSlot } from "./window/base_craft_window.js";

export const INVENTORY_CHANGE_NONE = 0;
// it may be adding or subtracting drag item from a slot, if slotIndex >= 0
export const INVENTORY_CHANGE_SLOTS = 1;
export const INVENTORY_CHANGE_MERGE_SMALL_STACKS = 2;
export const INVENTORY_CHANGE_CLOSE_WINDOW = 3;
export const INVENTORY_CHANGE_SHIFT_SPREAD = 4;

export class Inventory {
    [key: string]: any;
    player: Player

    temp_vec = new Vector();

    constructor(player : Player, state : any) {
        this.count              = state.items.length;
        this.player             = player;
        this.block_manager      = player.world.block_manager;
        this.current            = state.current;
        this.items              = new Array(this.count); // state.items;
        this.max_count          = INVENTORY_SLOT_COUNT;
        this.max_visible_count  = INVENTORY_VISIBLE_SLOT_COUNT;
        this.hotbar_count       = INVENTORY_HOTBAR_SLOT_COUNT;
        this._update_number     = 0
        this.onSelect           = (item) => {};
        this.applyNewItems(state.items, false)
        /**
         * @type { import("../tools/gui/wm.js").SimpleBlockSlot[] } slot
         */
        this.inventory_ui_slots = []
    }

    get update_number() {
        return this._update_number
    }

    set update_number(value) {
        this._update_number = value
        for(let slot of this.inventory_ui_slots) {
            slot.refresh()
        }
    }

    addInventorySlot(slot: CraftTableSlot): void {
        if(slot.slot_index === undefined || slot.slot_index === null) return
        this.inventory_ui_slots.push(slot)
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
        // if nothing changes, don't refresh
        refresh = refresh && !InventoryComparator.listsExactEqual(this.items, new_items);

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
        this.onSelect(this.current_item)
        this.update_number++
    }

    // Increment
    increment(mat, no_update_if_remains?: boolean): boolean {
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
            for(let i = 0; i < INVENTORY_DRAG_SLOT_INDEX; i++) {
                const item = this.items[i];
                if(item) {
                    if(InventoryComparator.itemsEqualExceptCount(item, mat)) {
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

    /** Decrements the power of {@link current_item}. */
    decrement_instrument() {
        if(!this.current_item || this.player.game_mode.isCreative()) {
            return;
        }
        const current_item_material = this.block_manager.fromId(this.current_item.id);
        if(current_item_material.power && current_item_material.item?.instrument_id) {
            this.current_item.power = Math.max(this.current_item.power - 1, 0);
            if(this.current_item.power <= 0) {
                this.items[this.current.index] = null;
            }
            this.refresh(true);
        }
    }

    /**
     * Decrements the current item.
     * @param {null} decrement_item - not processed, must be null
     */
    decrement(decrement_item = null, ignore_creative_game_mode? : boolean): void {
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
                const matBlock = this.block_manager.fromId(this.current_item.id);
                if(matBlock.item && matBlock.item?.name == 'bucket') {
                    if(matBlock.item.emit_on_set) {
                        const emptyBucket = this.block_manager.BUCKET;
                        this.items[this.current.index] = {id: emptyBucket.id, count: 1};
                    }
                } else if (matBlock.item && matBlock.item?.name == 'bottle') {
                    this.items[this.current.index] = {id: BLOCK.GLASS_BOTTLE.id, count: 1};
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

    /**
     * Decrements one or multiple items is visible slots by the given total amount,
     * or, if the given amount is not present, decrements by as much as posible.
     */
    decrementByItemID(item_id, count, dont_refresh) {
        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT; i++) {
            let item = this.items[i];
            if(!item || item.count < 1) {
                continue;
            }
            if(item.id == item_id) {
                count -= this.decrementByIndex(i, count);
                if (count === 0) {
                    break;
                }
            }
        }
        if(typeof dont_refresh === 'undefined' || !dont_refresh) {
            this.refresh(true);
        }
    }

    /**
     * Decrements the item count by {@link count} or by as much as posible, and removes the
     * item from list if the count becomes 0.
     * @param {Array|Object} list
     * @param { int } index
     * @param { int } count
     * @return { int } - the amount actually subtracted
     */
    static decrementByIndex(list, index, count = 1) {
        const item = list[index];
        if (item == null) {
            return 0;
        }
        if (item.count > count) {
            item.count -= count;
            return count;
        } else {
            ArrayOrMap.delete(list, index, null);
            return item.count;
        }
    }

    decrementByIndex(index, count = 1) {
        return Inventory.decrementByIndex(this.items, index, count);
    }

    countItemId(item_id) {
        var count = 0;
        for(let item of this.items) {
            if (item && item.id === item_id) {
                count += item.count;
            }
        }
        return count;
    }

    /**
     * Возвращает список того, чего и в каком количестве не хватает
     * в (текущем инвентаре + дополнительном списке предметов) по указанному списку.
     * @param {Array} resources - the array of needed resources, see {@link Recipe.calcNeedResources}
     * @param {Array} additionalItems - optional additional items, g.e. from craft slots.
     * @returns { object } with properties:
     *  - missing: Array - mising resuces
     *  - has: Array - the found resources
     */
    hasResources(resources, additionalItems = null) {
        const resp = {
            missing: [],
            has: []
        };
        // combined array of items
        const items = this.items.slice(0, INVENTORY_VISIBLE_SLOT_COUNT);
        additionalItems && items.push(...additionalItems);
        // array of mutable counts - no need to clone the the items themselves
        const counts = items.map(item => item?.count);
        // iterate the resources in order of decreasing needs specificity
        for(const resource of resources) {
            let count = resource.count;
            for(let i = 0; i < items.length; i++) {
                if (counts[i] && InventoryComparator.itemMatchesNeeds(items[i], resource.needs)) {
                    const take_count = Math.min(counts[i], count);
                    resp.has.push({
                        ...resource,
                        count: take_count,
                        item_index: i
                    });
                    counts[i] -= take_count;
                    count -= take_count;
                    if (count === 0) {
                        break;
                    }
                }
            }
            if(count > 0) {
                const r = {...resource, count};
                resp.missing.push(r);
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
        this.items[index] = item
        // Обновить текущий инструмент у игрока
        this.select(this.current.index)
    }

    next() {
        this.select(++this.current.index);
    }

    prev() {
        this.select(--this.current.index);
    }

    // Refresh
    refresh(resend : boolean) {
        return true;
    }

    // Клонирование материала в инвентарь
    cloneMaterial(pos, allow_create_new) {

        const { block_manager, player } = this;

        if(!player.game_mode.canBlockClone()) {
            return true;
        }

        //
        const tblock = player.world.getBlock(pos);
        let mat = tblock.material;

        if(mat.sham_block_name) {
            mat = player.world.block_manager[mat.sham_block_name]
        }

        //
        if(mat.id < 2 || mat.deprecated || mat.tags.includes('noclonable')) {
            return false;
        }
        while(mat.previous_part && mat.previous_part.id != mat.id) {
            let b = block_manager.fromId(mat.previous_part.id);
            mat = {id: b.id, previous_part: b.previous_part} as IBlockMaterial;
        }
        const cloned_block = block_manager.convertItemToInventoryItem(mat);
        delete(cloned_block.extra_data);
        if('power' in cloned_block && cloned_block.power == 0) {
            delete(cloned_block.power);
        }
        // Search same material with count < max
        for(let slot_key in Object.keys(this.items)) {
            const slot_index = parseInt(slot_key);
            if(this.items[slot_index]) {
                let item = this.items[slot_index];
                if(item.id == cloned_block.id) {
                    if(slot_index >= this.hotbar_count) {
                        // swith with another from inventory
                        this.items[slot_index] = this.items[this.current.index];
                        this.items[this.current.index] = item;
                        this.select(this.current.index);
                        return this.refresh(false);
                    } else {
                        // select if on hotbar
                        if(slot_index == this.current.index) {
                            const maxStack = BLOCK.getItemMaxStack(cloned_block);
                            item.count = Math.min(item.count + 1, maxStack);
                        }
                        this.select(slot_index);
                        return this.refresh(false);
                    }
                }
            }
        }
        if(!allow_create_new) {
            return false;
        }
        // Create in current cell if this empty
        if(this.current.index < this.hotbar_count) {
            let k = this.current.index;
            if(!this.items[k]) {
                this.items[k] = Object.assign({count: 1}, cloned_block);
                delete(this.items[k].texture);
                this.select(parseInt(k));
                return this.refresh(true);
            }
        }
        // Start new cell
        for(let k in Object.keys(this.items)) {
            if(parseInt(k) >= this.hotbar_count) {
                break;
            }
            if(!this.items[k]) {
                this.items[k] = Object.assign({count: 1}, cloned_block);
                delete(this.items[k].texture);
                this.select(parseInt(k));
                return this.refresh(true);
            }
        }
        // Replace current cell
        if(this.current.index < this.hotbar_count) {
            let k = this.current.index;
            this.items[k] = Object.assign({count: 1}, cloned_block);
            delete(this.items[k].texture);
            this.select(parseInt(k));
            return this.refresh(true);
        }
    }

    exportArmorState(): ArmorState {
        return {
            head: this.items[PLAYER_ARMOR_SLOT_HELMET]?.id,
            body: this.items[PLAYER_ARMOR_SLOT_CHESTPLATE]?.id,
            leg: this.items[PLAYER_ARMOR_SLOT_LEGGINGS]?.id,
            boot: this.items[PLAYER_ARMOR_SLOT_BOOTS]?.id,
        }
    }

    /**
     * Возвращает армор от надетых предметов
     * @returns {int}
     */
    getArmorLevel() {
        let resp = 0;
        for(const slot_index of [PLAYER_ARMOR_SLOT_BOOTS, PLAYER_ARMOR_SLOT_LEGGINGS, PLAYER_ARMOR_SLOT_CHESTPLATE, PLAYER_ARMOR_SLOT_HELMET]) {
            if(this.items[slot_index]) {
                const item = this.block_manager.fromId(this.items[slot_index].id);
                resp += item.armor?.damage ?? 0;
            }
        }
        return resp
    }

    /**
     * Возвращает прочность надетого премета
     * @returns {int}
     */
    getArmorPower(slot_index) {
        if (this.items[slot_index]) {
            return 10
        }
        return 0
    }

    /**
     * Deletes items with count = 0.
     * @param {Array|Object} items
     * @reurn null if nothing is deleted, or an error String
     */
    static fixZeroCount(items) {
        let res = null;
        for(let i in items) {
            const item = items[i];
            if (item?.count === 0) {
                res = res ?? `Error: count == 0 in slot ${i}, ${JSON.stringify(item)}`;
                ArrayOrMap.delete(items, i, null);
            }
        }
        return res;
    }

    fixZeroCount() {
        return Inventory.fixZeroCount(this.items);
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