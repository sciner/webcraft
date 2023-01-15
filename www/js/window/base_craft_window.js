import {BLOCK} from "../blocks.js";
import { Helpers, ArrayHelpers, ObjectHelpers, ArrayOrScalar, StringHelpers, IndexedColor } from "../helpers.js";
import { DRAW_SLOT_INDEX, INVENTORY_HOTBAR_SLOT_COUNT, INVENTORY_SLOT_SIZE, 
    INVENTORY_VISIBLE_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX, MOUSE } from "../constant.js";
import { INVENTORY_CHANGE_MERGE_SMALL_STACKS, INVENTORY_CHANGE_SHIFT_SPREAD } from "../inventory.js";
import { Label } from "../../tools/gui/wm.js";
import { INVENTORY_ICON_COUNT_PER_TEX } from "../chunk_const.js";
import { Recipe } from "../recipes.js";
import { InventoryComparator } from "../inventory_comparator.js";
import { BaseInventoryWindow } from "./base_inventory_window.js"
import { Enchantments } from "../enchantments.js";
import { createNoise2D } from '../../vendors/simplex-noise.js';
import { impl as alea } from '../../vendors/alea.js';

const ARMOR_SLOT_BACKGROUND_HIGHLIGHTED = '#ffffff55';
const ARMOR_SLOT_BACKGROUND_HIGHLIGHTED_OPAQUE = '#929292FF';
const DOUBLE_CLICK_TIME = 200.0;

const noiseRandom = new alea('enchantments_animations')
const noise2d = createNoise2D(noiseRandom.double);

export class HelpSlot extends Label {

    constructor(x, y, sz, id, ct) {
        super(x, y, sz, sz, id, null, null);
        this.ct = ct;
        this.item = null;
    }
    
    setItem(id) {
        this.item = id;
    }
    
    //
    get tooltip() {
        let resp = null;
        if(this.item) {
            const block = BLOCK.fromId(this.item);
            if(block) {
                resp = block.name.replaceAll('_', ' ') + ` (#${this.item})`;
            }
        }
        return resp;
    }
    
    // Draw slot
    draw(ctx, ax, ay) {
        if (this.ct.lblResultSlot.item) {
            return;
        }
        for(const slot of this.ct.craft.slots) {
            if (slot.item) {
                return;
            }
        } 
        this.applyStyle(ctx, ax, ay);
        this.fillBackground(ctx, ax, ay, this.item ? '#ff000055' : '#ff000000')
        this.drawItem(ctx, this.item, ax + this.x, ay + this.y, this.width, this.height);
        super.draw(ctx, ax, ay);
    }

    // Draw item
    drawItem(ctx, item, x, y, width, height) {
        
        const image = Qubatch.player.inventory.inventory_image;

        if(!image || !item) {
            return;
        }
        
        const size = image.width;
        const frame = size / INVENTORY_ICON_COUNT_PER_TEX;
        const zoom = this.zoom;
        const mat = BLOCK.fromId(item);

        ctx.imageSmoothingEnabled = true;

        // 1. Draw icon
        const icon = BLOCK.getInventoryIconPos(mat.inventory_icon_id, size, frame);
        const dest_icon_size = 40 * zoom;
        ctx.drawImage(
            image,
            icon.x,
            icon.y,
            icon.width,
            icon.height,
            x + width / 2 - dest_icon_size / 2,
            y + height / 2 - dest_icon_size / 2,
            dest_icon_size,
            dest_icon_size
        );
    }

}

export class CraftTableSlot extends Label {

    constructor(x, y, w, h, id, title, text, ct, slot_index) {
        super(x, y, w, h, id, null, null);
        this.ct = ct;
        this.setSlotIndex(slot_index);
    }

    //
    get tooltip() {
        let resp = null;
        let item = this.getItem();
        if(item) {
            if(item.id) {
                const block = BLOCK.fromId(item.id);
                if(block) {
                    const label = item.extra_data?.label;
                    resp = label
                        ? `${label} (${block.title}, #${item.id})`
                        : `${block.title} (#${item.id})`;
                    for(const [e, lvl] of Enchantments.ofItem(item)) {
                        resp += '\r' + e.name + ' ' + StringHelpers.romanize(lvl);
                    }
                    if (item.extra_data?.age) {
                        resp += '\rAnvil uses: ' + item.extra_data?.age;
                    }
                }
            } else {

            }
        }
        return resp;
    }

    setItem(item) {
        if(this.slot_index !== null) {   
            Qubatch.player.inventory.setItem(this.slot_index, item);
        } else {
            this.item = item;
            // @todo странная штука, но зато наслеуется
            if (this.ct.area) {
                this.ct.setHelperSlots(null);
            }
        }
    }

    getItem() {
        if(this.slot_index !== null) {
            return Qubatch.player.inventory.items[this.slot_index];
        } else {
            return this.item;
        }
    }

    getIndex() {
        return this.slot_index !== null ? this.slot_index : parseFloat(this.index);
    }

    // Draw slot
    draw(ctx, ax, ay) {
        this.applyStyle(ctx, ax, ay);
        let item = this.getItem();
        //
        if(DRAW_SLOT_INDEX) {
            ctx.fillStyle = '#00000022';
            ctx.font = '32px Ubuntu';
            ctx.fillText(this.slot_index || '', ax + this.x + 4, ay + this.y + 4);
        }
        //
        // this.drawItem(ctx, item, ax + this.x, ay + this.y, this.width, this.height);
        super.draw(ctx, ax, ay);
    }

    // Draw item
    async drawItem(ctx, item, x, y, width, height) {

        let image = this.ct.inventory.inventory_image;

        if(!image || !item) {
            return;
        }

        const size = image.width;
        const frame = size / INVENTORY_ICON_COUNT_PER_TEX;
        const zoom = this.zoom;
        const mat = BLOCK.fromId(item.id);

        ctx.imageSmoothingEnabled = true;

        // 1. Draw icon
        const icon = BLOCK.getInventoryIconPos(mat.inventory_icon_id, size, frame);
        const dest_icon_size = 40 * zoom;

        // if has enchantments
        if(!!(item?.extra_data?.enchantments ?? false)) {
            
            globalThis.draeench++

            if(this.item_prev != item) {

                this.item_prev = item

                // TODO: clear prev data from this.item_canvas

                const scnv = document.createElement('canvas')
                scnv.width = icon.width
                scnv.height = icon.height
                const sctx = scnv.getContext('2d')

                const scnv2 = document.createElement('canvas')
                scnv2.width = icon.width
                scnv2.height = icon.height
                const sctx2 = scnv2.getContext('2d')
                sctx2.drawImage(image, icon.x, icon.y, icon.width, icon.height, 0, 0, icon.width, icon.height)

                const imageData = sctx2.getImageData(0, 0, icon.width, icon.height)
                const orig_pixels_data = Array.from(imageData.data)

                this.item_canvas = {
                    scnv,
                    sctx,
                    scnv2,
                    sctx2,
                    imageData,
                    orig_pixels_data
                }
            }

            const imageData = this.item_canvas.imageData
            const orig_pixels_data = this.item_canvas.orig_pixels_data
            // const imageData = this.item_canvas.sctx2.getImageData(0, 0, icon.width, icon.height)

            // Copy result to source
            const pixs = imageData.data
            let idx = 0
            const scale = 50
            const pn = performance.now() / 2000
            for(let px = 0; px < icon.width; px++) {
                for(let py = 0; py < icon.height; py++) {
                    if(orig_pixels_data[idx + 3] > 0) {
                        const x2 = px + 100 + x * 100
                        const y2 = py + 100 + y * 100
                        let value = noise2d(px/scale - pn, py/scale - pn)
                        let value2 = noise2d(x2/scale + pn, y2/scale + pn)
                        value = (value+value2)/2
                        value = (value + .5) * 1.5
                        const r = value * (255 * .4)
                        const b = value * 255
                        pixs[idx + 0] = orig_pixels_data[idx + 0] * (1-value) + r * value
                        pixs[idx + 2] = orig_pixels_data[idx + 2] * (1-value) + b * value
                    }
                    idx += 4
                }
            }

            this.item_canvas.sctx.putImageData(imageData, 0, 0)
            image = this.item_canvas.scnv
            icon.x = 0
            icon.y = 0

        }

        ctx.drawImage(
            image,
            icon.x,
            icon.y,
            icon.width,
            icon.height,
            x + width / 2 - dest_icon_size / 2,
            y + height / 2 - dest_icon_size / 2,
            dest_icon_size,
            dest_icon_size
        );

        // 2. raw label
        let font_size = 18;
        const power_in_percent = mat?.item?.indicator == 'bar';
        let label = item.count > 1 ? item.count : null;
        let shift_y = 0;
        if(!label && 'power' in item) {
            if(power_in_percent) {
                label = (Math.round((item.power / mat.power * 100) * 100) / 100) + '%';
            } else {
                label = null;
            }
            font_size = 12;
            shift_y = -10;
        }
        if(label) {
            ctx.textBaseline        = 'bottom';
            ctx.textAlign           = 'right';
            ctx.font                = Math.round(font_size * zoom) + 'px ' + UI_FONT;
            ctx.fillStyle           = '#000000ff';
            ctx.fillText(label, x + width + 2 * zoom, y + height + (2 + shift_y) * zoom);
            ctx.fillStyle           = '#ffffffff';
            ctx.fillText(label, x + width, y + height + (shift_y) * zoom);
        }

        // 3. Draw instrument life
        if((mat.item?.instrument_id && item.power < mat.power) || power_in_percent) {
            const power_normal = Math.min(item.power / mat.power, 1);
            let cx = x + 4 * zoom;
            let cy = y + 3 * zoom;
            let cw = width - 8 * zoom;
            let ch = height - 6 * zoom;
            ctx.fillStyle = '#000000ff';
            ctx.fillRect(cx, cy + ch - 6 * zoom, cw, 6 * zoom);
            let rgb = Helpers.getColorForPercentage(power_normal);
            ctx.fillStyle = rgb.toCSS();
            ctx.fillRect(cx, cy + ch - 6 * zoom, cw * power_normal | 0, 4 * zoom);
        }

    }

    setSlotIndex(index) {
        this.slot_index = index;
    }

    getInventory() {
        return this.ct.inventory;
    }

    dropIncrementOrSwap(e, targetItem) {
        const player    = Qubatch.player;
        const drag      = e.drag;
        // @todo check instanceof!
        // if(dropData instanceof InventoryItem) {
        const dropData  = drag.getItem();
        if(!dropData.item) {
            return;
        }
        const max_stack_count = BLOCK.getItemMaxStack(dropData.item);

        // Если в текущей ячейке что-то есть
        if(targetItem) {
            // @todo
            if(InventoryComparator.itemsEqualExceptCount(targetItem, dropData.item)) {
                if(targetItem.count < max_stack_count) {
                    if(e.button_id == MOUSE.BUTTON_RIGHT && dropData.item.count > 1) {
                        targetItem.count++;
                        dropData.item.count--;
                    } else {
                        let new_count = targetItem.count + dropData.item.count;
                        let remains = 0;
                        if(new_count > max_stack_count) {
                            remains = new_count - max_stack_count;
                            new_count = max_stack_count;
                        }
                        targetItem.count = new_count;
                        dropData.item.count = remains;
                        if(dropData.item.count <= 0) {
                            drag.clear();
                        }
                    }
                    this.setItem(targetItem, e);
                }
            } else {
                // поменять местами перетаскиваемый элемент и содержимое ячейки
                this.setItem(dropData.item, e);
                player.inventory.items[INVENTORY_DRAG_SLOT_INDEX] = targetItem;
                dropData.item = targetItem;
            }
        } else {
            // Перетаскивание в пустую ячейку
            if(e.button_id == MOUSE.BUTTON_RIGHT && dropData.item.count > 1) {
                let newItem = {...dropData.item};
                newItem.count = 1;
                this.setItem(newItem, e);
                dropData.item.count--;
            } else {
                this.setItem(dropData.item, e);
                this.getInventory().clearDragItem();
            }
        }
        if (dropData.item.count === 0) {
            player.inventory.items[INVENTORY_DRAG_SLOT_INDEX] = null;
        }
    }

}

//
export class CraftTableResultSlot extends CraftTableSlot {

    constructor(x, y, w, h, id, title, text, ct) {
        super(x, y, w, h, id, title, text, ct, null);
        this.recipe = null;
        this.used_recipes = [];
        this.setupHandlers();
    }

    // Return used recipes and clear list
    getUsedRecipes() {
        const resp = this.used_recipes;
        this.used_recipes = [];
        return resp;
    }

    // decrements the slots, and remembers the recipe used.
    useRecipe() {
        // this.recipe can be null in some partially implemented window subclasses
        const recipe_id = this.recipe?.id || null;
        const used_items_keys = this.parent.getUsedItemsKeysAndDecrement(1);
        //
        const lastRecipe = this.used_recipes.length && this.used_recipes[this.used_recipes.length - 1];
        if (lastRecipe?.recipe_id === recipe_id &&
            ObjectHelpers.deepEqual(lastRecipe.used_items_keys, used_items_keys)
        ) {
            // increment the last used recipe count
            lastRecipe.count++;
        } else {
            this.used_recipes.push({
                recipe_id,
                used_items_keys,
                count: 1
            });
        }
        this.parent.checkRecipe();
    }

    // setupHandlers...
    setupHandlers() {

        let that = this;

        // onDrop
        this.onDrop = function(e) {
            let dragItem = this.getItem();
            let dropItem = e.drag.getItem().item;
            if(!dragItem || !dropItem) {
                return;
            }
            if(dragItem.id != dropItem.id) {
                return;
            }
            //
            const max_stack_count = BLOCK.getItemMaxStack(dropItem);
            if(dropItem.count + dragItem.count > max_stack_count) {
                return;
            }
            //
            if(dropItem.count + dragItem.count < max_stack_count) {
                dropItem.count += dragItem.count;
                // clear result slot
                this.setItem(null);
            } else {
                let remains = (dropItem.count + dragItem.count) - max_stack_count;
                dropItem.count = max_stack_count;
                dragItem.count = remains;
            }
            //
            that.useRecipe();
        }

        // Drag & drop
        this.onMouseDown = function(e) {
            let dragItem = this.getItem();
            if(!dragItem) {
                return;
            }
            // clear result slot
            this.setItem(null);
            // decrement craft slots
            while(true) {
                this.useRecipe();
                const next_item = this.getItem();
                if(!e.shiftKey || !next_item || next_item.id != dragItem.id) {
                    break;
                }
                const max_stack_count = BLOCK.getItemMaxStack(dragItem);
                if(dragItem.count + next_item.count > max_stack_count) {
                    break;
                }
                dragItem.count += next_item.count;
            }
            // set drag item
            this.parent.inventory.setDragItem(this, dragItem, e.drag, this.width, this.height);
        }
    
    }
    
}

export class CraftTableInventorySlot extends CraftTableSlot {

    /**
     * @param {Float} x - screen poition x
     * @param {Float} y - screen poition y
     * @param {BaseChestWindow} ct - parent window
     * @param {Object} options - optonal parameters:
     *  { readonly, onMouseEnterBackroundColor, disableIfLoading }
     */
    constructor(x, y, w, h, id, title, text, ct, slot_index, options = null) {
        
        super(x, y, w, h, id, title, text, ct, slot_index);

        this.options = options || {};

        // Custom drawing
        this.onMouseEnter = function() {
            if (this.options.disableIfLoading && this.ct.loading) {
                return;
            }
            this.style.background.color = this.options.onMouseEnterBackroundColor ?? '#ffffff55';
        }

        this.onMouseLeave = function() {
            // don't disable it if loading
            this.style.background.color = '#00000000';
        }

        // Drag
        this.onMouseDown = function(e) {
            if (this.options.disableIfLoading && this.ct.loading) {
                return;
            }
            const that        = this;
            const player      = Qubatch.player;
            const targetItem  = this.getInventoryItem();
            // Set new drag
            if(!targetItem) {
                return;
            }
            if(e.drag.getItem()) {
                return;
            }
            
            let dragItem = targetItem;
            // right button (divide to 2)
            if(e.button_id == MOUSE.BUTTON_RIGHT && targetItem.count > 1) {
                let split_count = Math.ceil(targetItem.count / 2);
                dragItem = {...targetItem};
                dragItem.count = split_count;
                targetItem.count -= split_count;
                this.setItem(targetItem, e);
            } else {
                if(e.shiftKey) {
                    switch(this.parent.id) {
                        case 'frmInventory': {
                            let srcList = this.parent.inventory_slots;
                            if(!this.appendToSpecialList(targetItem, srcList)) {
                                const ihsc = INVENTORY_HOTBAR_SLOT_COUNT
                                let srcListFirstIndexOffset = this.slot_index < ihsc ? ihsc : 0;
                                let targetList = this.slot_index < ihsc ? srcList.slice(srcListFirstIndexOffset) : srcList.slice(srcListFirstIndexOffset, ihsc);
                                if(this.slot_index >= INVENTORY_VISIBLE_SLOT_COUNT) {
                                    srcListFirstIndexOffset = 0
                                    targetList = srcList.slice(0, INVENTORY_VISIBLE_SLOT_COUNT)
                                } else {
                                    srcListFirstIndexOffset = this.slot_index < ihsc ? ihsc : 0;
                                    targetList = this.slot_index < ihsc ? srcList.slice(srcListFirstIndexOffset) : srcList.slice(srcListFirstIndexOffset, ihsc);
                                }
                                this.appendToList(targetItem, targetList, srcList, srcListFirstIndexOffset);
                            }
                            if(targetItem.count == 0) {
                                that.setItem(null, e);
                            }
                            break;
                        }
                        case 'frmBarrel':
                        case 'frmChest':
                        case 'frmDoubleChest':
                        case 'frmEnderChest':
                        case 'frmFurnace':
                        case 'frmChargingStation': {
                            if (this.ct.loading) {
                                break; // prevent spreading to the slots that are not ready
                            }
                            let srcList = e.target.is_chest_slot ? player.inventory.inventory_window.inventory_slots : this.parent.getSlots();
                            let srcListFirstIndexOffset = 0;
                            let targetList = srcList;
                            this.appendToList(targetItem, targetList, srcList, srcListFirstIndexOffset);
                            if(targetItem.count == 0) {
                                that.setItem(null, e);
                            }
                            this.parent.lastChange.type = INVENTORY_CHANGE_SHIFT_SPREAD;
                            break;
                        }
                        case 'frmCraft': {
                            let srcList = e.target.is_craft_slot ? player.inventory.inventory_window.inventory_slots : this.parent.getSlots();
                            let srcListFirstIndexOffset = 0;
                            let targetList = srcList;
                            this.appendToList(targetItem, targetList, srcList, srcListFirstIndexOffset);
                            if(targetItem.count == 0) {
                                that.setItem(null, e);
                            }
                        }
                        default: {
                            console.log('this.parent.id', this.parent.id);
                        }
                    }
                    return;
                }
                dragItem = targetItem;
                that.setItem(null, e);
            }
            this.getInventory().setDragItem(this, dragItem, e.drag, that.width, that.height);
            this.prev_mousedown_time = performance.now();
            this.prev_mousedown_button = e.button_id;
        }

        // if slot is readonly
        if(!this.readonly) {
            // Drop
            this.onDrop = function(e) {
                if (this.options.disableIfLoading && this.ct.loading) {
                    return;
                }
                let player      = Qubatch.player;
                let drag        = e.drag;
                // @todo check instanceof!
                // if(dropData instanceof InventoryItem) {
                let dropData    = drag.getItem();
                let targetItem  = this.getInventoryItem();
                if(!dropData) {
                    return;
                }
                const max_stack_count = BLOCK.getItemMaxStack(dropData.item);
                // check if double click by left mouse button
                const potential_double_click = this.prev_mousedown_time && (e.button_id === MOUSE.BUTTON_LEFT) && (this.prev_mousedown_button == MOUSE.BUTTON_LEFT) && !e.shiftKey;
                const doubleClick = potential_double_click && (performance.now() - this.prev_mousedown_time < DOUBLE_CLICK_TIME) && (max_stack_count > 1);
                if(doubleClick) {
                    // 1. Объединение мелких ячеек в одну при двойном клике на ячейке
                    // It gives the same result in chest_manager.js: applyClientChange()
                    if(dropData.item.count < max_stack_count) {
                        let need_count = max_stack_count - dropData.item.count;
                        // проверить крафт слоты
                        let slots = this.parent.getSlots();
                        const list = [];
                        for(let i in slots) {
                            const item = slots[i]?.item;
                            if (InventoryComparator.itemsEqualExceptCount(item, dropData.item) &&
                                item.count != max_stack_count
                            ) {
                                list.push({chest: 1, index: i, item: item});
                            }
                        }
                        // проверить слоты инвентаря
                        const inventory_items = player.inventory.items;
                        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT; ++i) {
                            const item = inventory_items[i];
                            if (InventoryComparator.itemsEqualExceptCount(item, dropData.item) &&
                                item.count != max_stack_count
                            ) {
                                list.push({chest: 0, index: i, item: item});
                            }
                        }
                        list.sort(function(a, b){
                            var t = a.item.count - b.item.count;
                            if (t != 0) {
                                return t;
                            }
                            return (a.index - b.index) - 1000 * (a.chest - b.chest);
                        });
                        for (var v of list) {
                            if (need_count == 0) {
                                break;
                            }
                            const item = v.item;
                            let minus_count = item.count < need_count ? item.count : need_count;
                            need_count -= minus_count;
                            dropData.item.count += minus_count;
                            item.count -= minus_count;                            
                            if (item.count < 1) {
                                if (v.chest) {
                                    slots[v.index].setItem(null, e);
                                } else {
                                    player.inventory.setItem(v.index, null);
                                }
                            }
                            if (this.parent.lastChange) { // present in chests, not in craft windows
                                this.parent.lastChange.type = INVENTORY_CHANGE_MERGE_SMALL_STACKS;
                            }
                        }
                        return;
                    }
                }

                this.dropIncrementOrSwap(e, targetItem);
            }
        }
    }

    get readonly() {
        return !!this.options.readonly;
    }

    /**
     * Помещает предмет в список (например инвентарный)
     * @param {*} srcItem Исходный слот для перемещения
     * @param {*} target_list Итоговый  список слотов, куда нужно переместить исходный слот
     */
    appendToSpecialList(srcItem, target_list) {
        if(srcItem.entity_id || srcItem.extra_data) {
            return false
        }
        const srcBlock = BLOCK.fromId(srcItem.id)
        // 0. Поиск специализированных слотов брони
        for(let slot of target_list) {
            if(slot instanceof ArmorSlot && srcBlock.armor && slot.slot_index == srcBlock.armor.slot) {
                const item = slot.getItem();
                if(!slot.readonly && !item) {
                    slot.setItem({...srcItem})
                    srcItem.count = 0
                    return true
                }
            }
        }
        return false
    }

    /**
     * Помещает предмет в список (например инвентарный)
     * @param {*} srcItem Исходный слот для перемещения
     * @param {*} target_list Итоговый  список слотов, куда нужно переместить исходный слот
     * @param {*} srcList Ссылка на оригинальный список, чтобы можно было в него добавить/заменить новый элемент
     * @param {*} srcListFirstIndexOffset Смещение в оригинальном списке, откуда взяли target_list
     */
    appendToList(srcItem, target_list, srcList, srcListFirstIndexOffset) {
        if(typeof srcListFirstIndexOffset != 'number') {
            throw 'Invalid srcListFirstIndexOffset';
        }
        if(!srcItem.entity_id && !srcItem.extra_data) {
            const max_stack_count = BLOCK.getItemMaxStack(srcItem);
            // 1. проход в поисках подобного
            if(srcItem.count > 0) {
                for(let slot of target_list) {
                    if(slot instanceof CraftTableInventorySlot) {
                        const item = slot.getItem();
                        if(!slot.readonly && InventoryComparator.itemsEqualExceptCount(item, srcItem)) {
                            let free_count = max_stack_count - item.count;
                            if(free_count > 0) {
                                let count = Math.min(free_count, srcItem.count);
                                srcItem.count -= count
                                item.count += count;
                                slot.setItem(item);
                            }
                        }
                    } else {
                        console.error(slot);
                        throw 'error_invalid_slot_type';
                    }
                }
            }
        }
        // 2. проход в поисках свободных слотов
        if(srcItem.count > 0) {
            for(let index in target_list) {
                const slot = target_list[index];
                if(slot instanceof CraftTableInventorySlot) {
                    if(!slot.readonly && !slot.getItem()) {
                        let slot_index = (srcListFirstIndexOffset | 0) + (index | 0);
                        srcList[slot_index].setItem({...srcItem});
                        srcItem.count = 0;
                        break;
                    }
                } else {
                    throw 'error_invalid_slot_type';
                }
            }
        }
    }

    draw(ctx, ax, ay) {
        this.applyStyle(ctx, ax, ay);
        let item = this.getInventoryItem();
        this.drawItem(ctx, item, ax + this.x, ay + this.y, this.width, this.height);
        super.draw(ctx, ax, ay);
    }    

    getInventoryItem() {
        return this.ct.inventory.items[this.slot_index] || this.item;
    }
    
}

// Ячейка рецепта
export class CraftTableRecipeSlot extends CraftTableInventorySlot {

    // Вызывается после изменения любой из её ячеек
    setItem(item) {
        super.setItem(item);
        this.parent.checkRecipe();
    }

}

export class ArmorSlot extends CraftTableInventorySlot {
    
    constructor(x, y, s, id, ct) {

        super(x, y, s, s, 'lblSlot' + id, null, null, ct, id);
        // Custom drawing
        this.onMouseEnter = function(e) {
            const dragItem = Qubatch.hud.wm.drag.getItem();
            if (!dragItem || this.isValidDragItem(dragItem)) {
                this.style.background.color = ARMOR_SLOT_BACKGROUND_HIGHLIGHTED;
            }
        }

        const origOnMouseDown = this.onMouseDown.bind(this);

        // Make the slot instantly highlighted when we take the item from it
        this.onMouseDown = function(e) {
            origOnMouseDown(e);
            this.onMouseEnter(e);
        }

        /*
        // Drag
        this.onMouseDown = function(e) {
            const targetItem  = this.getInventoryItem();
            if(!targetItem || e.drag.getItem()) {
                return;
            }
            this.setItem(null, e);
            this.getInventory().setDragItem(this, targetItem, e.drag, this.width, this.height);
        }

        this.onDrop = function(e) {
            const dropData    = e.drag.getItem();
            const targetItem  = this.getInventoryItem();
            if(!dropData) {
               return;
            }
            const item = BLOCK.fromId(dropData.item.id);
            if (item?.item?.name != 'armor' || item.armor.slot != this.slot_index) {
                return;
            }
            this.setItem(dropData.item, e);
            if (targetItem) {
                Qubatch.player.inventory.items[INVENTORY_DRAG_SLOT_INDEX] = targetItem;
                dropData.item = targetItem;
            } else {
                this.getInventory().clearDragItem();
            }
        }
        */

        const origOnDrop = this.onDrop.bind(this);

        this.onDrop = function(e) {
            const dragItem = e.drag.getItem();
            if(this.isValidDragItem(dragItem)) {
                return origOnDrop(e);
            }
        }
    }

    isValidDragItem(dragItem) {
        if(!dragItem) {
            return false;
        }
        const mat = BLOCK.fromId(dragItem.item.id);
        return mat?.item?.name == 'armor' && (mat.armor.slot == this.slot_index);
    }
    
    draw(ctx, ax, ay) {
        this.applyStyle(ctx, ax, ay);
        const item = this.getInventoryItem();
        if(item) {
            // fill background color
            let x = ax + this.x;
            let y = ay + this.y;
            let w = this.width;
            let h = this.height;
            ctx.fillStyle = this.style.background.color == ARMOR_SLOT_BACKGROUND_HIGHLIGHTED
                ? ARMOR_SLOT_BACKGROUND_HIGHLIGHTED_OPAQUE : '#8f8d88ff';
            ctx.fillRect(x, y, w, h);
        }
        this.drawItem(ctx, item, ax + this.x, ay + this.y, this.width, this.height);
        super.draw(ctx, ax, ay);
    }

    getInventory() {
        return this.ct.inventory;
    }
    
    getInventoryItem() {
        return this.ct.inventory.items[this.slot_index] || this.item;
    }
    
}

export class BaseCraftWindow extends BaseInventoryWindow {

    /**
    * Итоговый слот (то, что мы получим)
    */
     createResultSlot(x, y) {
        const ct = this;
        // x, y, w, h, id, title, text, ct, slot_index
        let lblResultSlot = this.lblResultSlot = new CraftTableResultSlot(x, y, this.cell_size, this.cell_size, 'lblCraftResultSlot', null, null, ct);
        lblResultSlot.onMouseEnter = function() {
            this.style.background.color = '#ffffff33';
        }
        lblResultSlot.onMouseLeave = function() {
            this.style.background.color = '#00000000';
        }
        ct.add(lblResultSlot);
    }

    /**
    * Создание слотов для инвентаря
    * @param int sz Ширина / высота слота
    * @param int xs Смешение словтов по оси x
    * @param int ys Смешение словтов по оси y
    */
    createInventorySlots(sz, sx = 14, sy = 166) {
        const ct = this;
        if(ct.inventory_slots) {
            console.error('createInventorySlots() already created');
            return;
        }
        ct.inventory_slots  = [];
        const xcnt = INVENTORY_HOTBAR_SLOT_COUNT;
        sx *= this.zoom;
        sy *= this.zoom;
        // не менять порядок нижних и верхних!
        // иначе нарушится их порядок в массиве ct.inventory_slots
        // нижний ряд (видимые на хотбаре)
        for(let i = 0; i < INVENTORY_HOTBAR_SLOT_COUNT; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, (sy + 116 * this.zoom) + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom), sz, sz, 'lblSlot' + (i), null, '' + i, this, i);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
        // верхние 3 ряда
        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT - INVENTORY_HOTBAR_SLOT_COUNT; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom), sz, sz, 'lblSlot' + (i + 9), null, '' + (i + 9), this, i + 9);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
    }

    clearCraftSlotIfPosible(slot) {
        let item = slot.getItem();
        if(item) {
            if (!this.inventory.increment(slot.item)) {
                return false;
            }
            slot.setItem(null);
        }
        return true;
    }

    clearCraft() {
        // Drag
        this.inventory.clearDragItem(true);
        // Clear result
        this.lblResultSlot.setItem(null);
        //
        for(let slot of this.craft.slots) {
            if(slot) {
                this.clearCraftSlotIfPosible(slot);
            }
        }
    }

    getCraftSlotItemsArray() {
        return this.craft.slots.map(it => it?.item);
    }

    // Returns used_items (an array item comparison keys - to send to the server), and decrements craft slots
    getUsedItemsKeysAndDecrement(count) {
        const result = [];
        for(let [i, slot] of this.craft.slots.entries()) {
            let item = slot.getItem();
            if (item) {
                result.push(InventoryComparator.makeItemCompareKey(item));
                item.count -= ArrayOrScalar.get(count, i);
                if (item.count <= 0) {
                    slot.setItem(null);
                }
            }
        }
        return result;
    }

    getSimpleItems() {
        return InventoryComparator.groupToSimpleItems(this.inventory.items, this.getCraftSlotItemsArray());
    }

    //
    getCurrentSlotsSearchPattern() {
        const item_ids = [];
        for(let slot of this.craft.slots) {
            const item = slot.getItem();
            item_ids.push(item?.id || null);
        }
        return Recipe.craftingSlotsToSearchPattern(item_ids, this.area.size);
    }

    // Автоматически расставить рецепт в слотах по указанному рецепту
    autoRecipe(recipe, shiftKey) {
        // Validate area size
        if(recipe.size.width > this.area.size.width) {
            return false;
        }
        if(recipe.size.height > this.area.size.height) {
            return false;
        }
        const searchPattern = this.getCurrentSlotsSearchPattern();
        // Search for a best matching pattern
        let pattern = recipe.findAdaptivePattern(searchPattern);
        if (!pattern) {
            this.clearCraft();
            // if we can't find the exact match, use the 1st pattern
            pattern = recipe.adaptivePatterns[this.area.size.width][0];
        }
        const start_index = pattern.start_index;

        // if shiftKey was pressed, repeat addin 1 to eah slot until we run out of resources
        do {
            // Find pattern slots that we can increent by 1, taking into account the items already placed.
            const array_needs = [...pattern.array_id];
            for(let i = 0; i < array_needs.length; i++) {
                const item = this.craft.slots[start_index + i].getItem();
                // if there is an item in this slot, we can use only compatible items
                if (item && array_needs[i]) {
                    if (item.count == BLOCK.getItemMaxStack(item)) {
                        // we don't need to increment it
                        array_needs[i] = null;
                    } else if (InventoryComparator.itemMatchesNeeds(item, array_needs[i])) {
                        // we need to increment it, but only this spicific item fits
                        array_needs[i] = item;
                    } else {
                        // we need to increment it, but nothing fits
                        array_needs[i] = [];
                    }
                }
            }
            // For each needed resource, remember its slot index as its key
            const needResourcesKeys = ArrayHelpers.create(array_needs.length, i => start_index + i);
            const needResources = Recipe.calcNeedResources(array_needs, needResourcesKeys);
            const hasResources = Qubatch.player.inventory.hasResources(needResources);
            if (// if we can't increment every slot that needs it
                hasResources.missing.length ||
                // or there is no change
                hasResources.has.length === 0
            ) {
                return;
            }
            // Here the slots may contain: pattern items, empty items that should be set according to the pattern,
            // and garbage that we couldn't clear because there is no space.

            // Put the found resources into the slots
            for (const r of hasResources.has) {
                const slot = this.craft.slots[r.key];
                const item = slot.getItem();
                if (item == null) {
                    const inventoryItem = Qubatch.player.inventory.items[r.item_index];
                    slot.setItem({...inventoryItem, count: 1});
                } else {
                    item.count++;
                }
                Qubatch.player.inventory.decrementByIndex(r.item_index);
            }
        } while (shiftKey);
    }
    
    // слоты помощи в крафте
    addHelpSlots() {
        const size = this.area.size.width;
        const sx = (size == 2) ? 196 : 60.5;
        const sy = (size == 2) ? 36 : 34.5;
        this.help_slots = [];
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const slot = new HelpSlot((sx + 36 * j) * this.zoom, (sy + 36 * i) * this.zoom, 32 * this.zoom, 'help_' + i + '_' + j, this);
                this.help_slots.push(slot);
                this.add(slot);
            }
        }
    }
    
    // показываем помощь
    setHelperSlots(recipe) {
        const size = this.area.size.width;
        for (let i = 0; i < size * size; i++) {
            this.help_slots[i].setItem(null);
        }
        if (recipe) {
            const adapter = recipe.adaptivePatterns[size][0];
            if (adapter) {
                for (let i = 0; i < adapter.array_id.length; i++) {
                    const ids = adapter.array_id[i];
                    this.help_slots[i + adapter.start_index].setItem(ids ? ids[0] : null);
                }
            }
        }
    }

    /**
     * Finds a recipe that matches the current slots.
     * Sets up the craft result slot depending on it.
     */
    checkRecipe() {
        const searchPattern = this.getCurrentSlotsSearchPattern();
        this.lblResultSlot.recipe = this.recipes.crafting_shaped.searchRecipe(searchPattern);
        if(!this.lblResultSlot.recipe) {
            return this.lblResultSlot.setItem(null);
        }
        const resultBlock = this.recipes.createResultItem(this.lblResultSlot.recipe);
        this.lblResultSlot.setItem(resultBlock);
    }
}