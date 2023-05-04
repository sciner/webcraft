import {BLOCK} from "../blocks.js";
import { ArrayHelpers, ObjectHelpers, ArrayOrScalar, StringHelpers } from "../helpers.js";
import { INVENTORY_HOTBAR_SLOT_COUNT,
    INVENTORY_VISIBLE_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX, MOUSE, UI_THEME } from "../constant.js";
import { INVENTORY_CHANGE_MERGE_SMALL_STACKS, INVENTORY_CHANGE_SHIFT_SPREAD } from "../inventory.js";
import { Label, SimpleBlockSlot, Window, Button, ToggleButton } from "../ui/wm.js";
import { Recipe } from "../recipes.js";
import { InventoryComparator } from "../inventory_comparator.js";
import { BaseInventoryWindow } from "./base_inventory_window.js"
import { Enchantments } from "../enchantments.js";
import { getBlockImage } from "./tools/blocks.js";
import type { PlayerInventory } from "../player_inventory.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Resources } from "../resources.js";
import type {Hotbar} from "../hotbar.js";
import type {CreativeInventoryWindow} from "./creative_inventory.js";
import { Lang } from "../lang.js";

const ARMOR_SLOT_BACKGROUND_HIGHLIGHTED = '#ffffff55'
const ARMOR_SLOT_BACKGROUND_HIGHLIGHTED_OPAQUE = '#929292FF'
const ARMOR_SLOT_BACKGROUND_ACTIVE = '#828282ff'
const DOUBLE_CLICK_TIME = 300.0;

export class HelpSlot extends Label {

    hud_atlas : SpriteAtlas

    constructor(x : float, y : float, sz : float, id : string, ct : Window) {
        super(x, y, sz, sz, id, null, null)
        this.ct = ct
        this.item = null
        this.swapChildren(this.children[0], this.children[1])
        this.hud_atlas = Resources.atlas.get('hud')
        // this.setBackground(this.hud_atlas.getSpriteFromMap('window_slot_locked'))
        this.setBackground(this.hud_atlas.getSpriteFromMap('window_slot'))
    }

    setItem(id : int) {

        this.item = id

        this.style.background.color = id ? '#ff000055' : '#ff000000'

        if(id) {
            this.block = BLOCK.fromId(id)
            const tintMode = 0 // item.extra_data?.enchantments ? 1 : 0
            this.setIcon(getBlockImage(this.block), 'centerstretch', 1.0, tintMode)
        } else {
            this.block = null
            this.setIcon(null)
        }

    }

    get can_make() {
        return !this.item
    }

    //
    get tooltip() {
        if(this.block) {
            return this.block.name.replaceAll('_', ' ') + ` (#${this.item})`
        }
        return null
    }

}

export type TCraftTableSlotContext = BaseInventoryWindow | CreativeInventoryWindow | Hotbar

export class CraftTableSlot extends SimpleBlockSlot {
    [key: string]: any;

    declare parent: TCraftTableSlotContext
    ct: TCraftTableSlotContext
    slot_index: int

    constructor(x: float, y: float, w: float, h: float, id: string, title: string, text: string, ct: TCraftTableSlotContext, slot_index: int) {
        super(x, y, w, h, id, null, '')
        this.ct = ct
        this.setSlotIndex(slot_index)
        ct.inventory.addInventorySlot(this)
        // this.style.background.color = '#00000011'
        // this.style.border.color = '#00000033'
        this.style.border.hidden = true
        // this.style.border.style = 'inset'
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

    isInventorySlot() {
        return this.slot_index !== null && this.slot_index !== undefined
    }

    getItem(): IInventoryItem | null {
        if(this.isInventorySlot()) {
            return this.ct.inventory.items[this.slot_index]
        } else {
            return this.item ?? null
        }
    }

    //@ts-ignore
    setItem(item: IInventoryItem | null, update_inventory : boolean = true): boolean {
        if (item && item.count <= 0) {
            if (item.count < 0) {
                window.alert('item.count < 0')
            }
            item = null
        }
        if(!super.setItem(item)) {
            return false
        }

        if(!update_inventory) {
            return false
        }

        // Update inventory
        if(this.isInventorySlot()) {
            this.ct.inventory.setItem(this.slot_index, item)
        } else {
            this.item = item
            // @todo странная штука, но зато наследуется
            if (this.ct.area) {
                this.ct.setHelperSlots(null)
            }
        }
        return true
    }

    getIndex() {
        return this.isInventorySlot() ? this.slot_index : parseFloat(this.index);
    }

    setSlotIndex(index) {
        this.slot_index = index
    }

    getInventory() : PlayerInventory {
        return this.ct.inventory
    }

    dropIncrementOrSwap(e, targetItem) {
        const player    = Qubatch.player;
        const drag      = e.drag;
        // @todo check instanceof!
        // if(dropData instanceof InventoryItem) {
        const dropItem  = drag.getItem()
        if(!dropItem) {
            return;
        }
        if(drag && drag.slot === this) {
            drag.slot = null
            return
        }
        const max_stack_count = BLOCK.getItemMaxStack(dropItem)

        // Если в текущей ячейке что-то есть
        if(targetItem) {
            // @todo
            if(InventoryComparator.itemsEqualExceptCount(targetItem, dropItem)) {
                if(targetItem.count < max_stack_count) {
                    if(e.button_id == MOUSE.BUTTON_RIGHT && dropItem.count > 1) {
                        targetItem.count++;
                        dropItem.count--;
                    } else {
                        let new_count = targetItem.count + dropItem.count;
                        let remains = 0;
                        if(new_count > max_stack_count) {
                            remains = new_count - max_stack_count;
                            new_count = max_stack_count;
                        }
                        targetItem.count = new_count;
                        dropItem.count = remains;
                        if(dropItem.count <= 0) {
                            drag.clear();
                        }
                    }
                    this.setItem(targetItem, e);
                }
            } else {
                // поменять местами перетаскиваемый элемент и содержимое ячейки
                this.setItem(dropItem, e);
                player.inventory.items[INVENTORY_DRAG_SLOT_INDEX] = targetItem;
                drag.setItem(targetItem)
            }
        } else {
            // Перетаскивание в пустую ячейку
            if(e.button_id == MOUSE.BUTTON_RIGHT && dropItem.count > 1) {
                let newItem = {...dropItem};
                newItem.count = 1;
                this.setItem(newItem, e);
                dropItem.count--;
            } else {
                this.setItem(dropItem, e);
                this.getInventory().clearDragItem();
            }
        }
        if (dropItem.count === 0) {
            player.inventory.items[INVENTORY_DRAG_SLOT_INDEX] = null;
        }
        drag.refresh()
        this.ct.fixAndValidateSlots('CraftTableSlot dropIncrementOrSwap')
        return true
    }

}

//
export class CraftTableResultSlot extends CraftTableSlot {
    [key: string]: any;

    slot_empty = 'window_slot_locked'

    constructor(x, y, w, h, id, title, text, ct) {
        super(x, y, w, h, id, title, text, ct, null);
        this.recipe = null;
        this.used_recipes = [];
        this.setupHandlers()
        this.refresh()
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
        this.parent.fixAndValidateSlots('CraftTableResultSlot useRecipe')
    }

    // setupHandlers...
    setupHandlers() {

        let that = this;

        // onDrop
        this.onDrop = function(e) {
            const drag = e.drag
            let resultItem = this.getItem();
            let dropItem = drag.getItem();
            if(!resultItem || !dropItem) {
                return;
            }
            if(resultItem.id != dropItem.id) {
                return;
            }
            // prevent dropping into the same sloft after the mouse is released
            if(drag?.slot === this) {
                drag.slot = null
                return
            }
            // Check if we can add drag the entire result stack to the drag item.
            const max_stack_count = BLOCK.getItemMaxStack(dropItem);
            if(dropItem.count + resultItem.count > max_stack_count) {
                return;
            }
            // The entire result stack is added to the drag item.
            dropItem.count += resultItem.count;
            this.setItem(null);
            drag.setItem(dropItem);
            //
            that.useRecipe();
            this.parent.fixAndValidateSlots('CraftTableResultSlot onDrop')
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
            this.parent.inventory.setDragItem(this, dragItem, e.drag, this.w, this.h);
            this.parent.fixAndValidateSlots('CraftTableResultSlot onMouseDown')
        }

    }

}

export class CraftTableInventorySlot extends CraftTableSlot {

    prev_mousedown_time = -Infinity
    prev_mousedown_button: int

    constructor(x : float, y : float, w : float, h : float, id : string, title : string, text : string, ct : TCraftTableSlotContext, slot_index : int, options : object = null) {

        super(x, y, w, h, id, title, text, ct, slot_index)

        this.options = options || {}

        // if slot is readonly
        if(!this.readonly) {

            // Drop
            this.onDrop = function(e) {

                if (this.options.disableIfLoading && this.ct.loading) {
                    return
                }
                const player      = Qubatch.player
                const drag        = e.drag
                if(drag && drag.slot === this) {
                    drag.slot = null
                    return
                }

                // @todo check instanceof!
                // if(dropData instanceof InventoryItem) {
                const dropItem    = drag.getItem()
                const targetItem  = this.getItem()
                if(!dropItem) {
                    return
                }
                const max_stack_count = BLOCK.getItemMaxStack(dropItem)
                // check if double click by left mouse button
                const potential_double_click = this.prev_mousedown_time && (e.button_id === MOUSE.BUTTON_LEFT) && (this.prev_mousedown_button == MOUSE.BUTTON_LEFT) && !e.shiftKey
                const doubleClick = potential_double_click && (performance.now() - this.prev_mousedown_time < DOUBLE_CLICK_TIME) && (max_stack_count > 1)
                if(doubleClick) {
                    // 1. Объединение мелких ячеек в одну при двойном клике на ячейке
                    // It gives the same result in chest_manager.js: applyClientChange()
                    if(dropItem.count < max_stack_count) {
                        let need_count = max_stack_count - dropItem.count
                        const list = [];
                        // проверить крафт слоты или слоты сундука
                        const craftSlots = this.parent.getCraftOrChestSlots()
                        for(let i = 0; i < craftSlots.length; i++) {
                            const item = craftSlots[i]?.item
                            if (InventoryComparator.itemsEqualExceptCount(item, dropItem)) {
                                list.push({chest: 1, index: i, item: item})
                            }
                        }
                        // проверить слоты инвентаря
                        const inventory_items = player.inventory.items
                        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT; ++i) {
                            const item = inventory_items[i];
                            if (InventoryComparator.itemsEqualExceptCount(item, dropItem)) {
                                list.push({chest: 0, index: i, item: item})
                            }
                        }
                        list.sort(function(a, b){
                            var t = a.item.count - b.item.count;
                            if (t != 0) {
                                return t
                            }
                            return (a.index - b.index) - 1000 * (a.chest - b.chest);
                        })
                        for(var v of list) {
                            if (need_count == 0) {
                                break
                            }
                            let item = v.item
                            let minus_count = item.count < need_count ? item.count : need_count;
                            need_count -= minus_count
                            dropItem.count += minus_count
                            drag.refresh()
                            item.count -= minus_count
                            if (item.count === 0) {
                                item = null
                            }
                            if (v.chest) {
                                craftSlots[v.index].setItem(item, e)
                            } else {
                                player.inventory.setItem(v.index, item)
                            }
                            if (this.parent.lastChange) { // present in chests, not in craft windows
                                this.parent.lastChange.type = INVENTORY_CHANGE_MERGE_SMALL_STACKS;
                            }
                        }
                        this.ct.fixAndValidateSlots('CraftTableInventorySlot doubleClick')
                        return
                    }
                }

                this.dropIncrementOrSwap(e, targetItem)

            }

        }

        // TODO: pixi
        this.setItem(this.getItem(), false)

    }

    // Custom drawing
    // onMouseEnter(e) {
    //     if (this.options.disableIfLoading && this.ct.loading) {
    //         return
    //     }
    //     // this.style.background.color = this.options.onMouseEnterBackroundColor ?? '#ffffff55'
    // }

    // onMouseLeave(e) {
    //     // don't disable it if loading
    //     // this.style.background.color = '#00000000'
    // }

    // Mouse down
    onMouseDown(e) {

        if (this.options.disableIfLoading && this.ct.loading) {
            return
        }

        const that        = this
        const player      = Qubatch.player
        const targetItem  = this.getItem()

        // Set new drag
        if(!targetItem) {
            return
        }
        if(e.drag.getItem()) {
            return
        }

        let dragItem = targetItem

        // right button (divide to 2)
        if(e.button_id == MOUSE.BUTTON_RIGHT && targetItem.count > 1) {
            let split_count = Math.ceil(targetItem.count / 2)
            dragItem = {...targetItem};
            dragItem.count = split_count;
            targetItem.count -= split_count;
            this.setItem(targetItem, e);
            this.ct.fixAndValidateSlots('CraftTableInventorySlot right button')
        } else {
            if(e.shiftKey) {
                switch(this.parent.id) {
                    case 'frmCharacterWindow':
                    case 'frmInventory': {
                        const srcList = this.parent.inventory_slots;
                        if(!this.appendToSpecialList(targetItem, srcList)) {
                            const ihsc = INVENTORY_HOTBAR_SLOT_COUNT
                            let srcListFirstIndexOffset = this.slot_index < ihsc ? ihsc : 0;
                            let targetList = this.slot_index < ihsc ? srcList.slice(srcListFirstIndexOffset) : srcList.slice(srcListFirstIndexOffset, ihsc);
                            if(this.slot_index >= INVENTORY_VISIBLE_SLOT_COUNT) {
                                targetList = srcList.slice(0, INVENTORY_VISIBLE_SLOT_COUNT)
                            } else {
                                targetList = this.slot_index < ihsc ? srcList.slice(srcListFirstIndexOffset) : srcList.slice(srcListFirstIndexOffset, ihsc);
                            }
                            this.appendToList(targetItem, targetList);
                        }
                        this.setItem(targetItem, e)
                        this.ct.fixAndValidateSlots('CraftTableInventorySlot shiftKey frmInventory')
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
                        let targetList = e.target.is_chest_slot ? this.parent.inventory_slots : this.parent.getCraftOrChestSlots()
                        this.appendToList(targetItem, targetList)
                        this.setItem(targetItem, e)
                        this.parent.lastChange.type = INVENTORY_CHANGE_SHIFT_SPREAD
                        this.ct.fixAndValidateSlots('CraftTableInventorySlot INVENTORY_CHANGE_SHIFT_SPREAD')
                        break
                    }
                    case 'frmCraft': {
                        let targetList = e.target.is_craft_slot ? this.parent.inventory_slots : this.parent.getCraftOrChestSlots()
                        this.appendToList(targetItem, targetList)
                        this.setItem(targetItem, e)
                        this.ct.fixAndValidateSlots('CraftTableInventorySlot frmCraft')
                        break
                    }
                    default: {
                        console.log('this.parent.id', this.parent.id)
                    }
                }
                return
            }
            dragItem = targetItem
            that.setItem(null, e)
        }
        this.getInventory().setDragItem(this, dragItem, e.drag, that.width, that.height)
        this.prev_mousedown_time = performance.now()
        this.prev_mousedown_button = e.button_id
        this.ct.fixAndValidateSlots('CraftTableInventorySlot onMouseDown')
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
            if(slot instanceof PaperDollSlot && srcBlock.armor && slot.slot_index == srcBlock.armor.slot) {
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
     * Модифицирует количество в {@link srcItem}. После перемещения, вызывающий должен не забыть обновить исходный слот.
     * @param {*} srcItem Исходный слот для перемещения
     * @param {*} target_list Итоговый  список слотов, куда нужно переместить исходный слот
     */
    appendToList(srcItem, target_list) {
        if (srcItem.count === 0) {
            return
        }
        const max_stack_count = BLOCK.getItemMaxStack(srcItem);
        // 1. проход в поисках подобного
        for(let slot of target_list) {
            if(slot instanceof CraftTableInventorySlot) {
                const item = slot.getItem();
                if(!slot.readonly && InventoryComparator.itemsEqualExceptCount(item, srcItem)) {
                    const free_count = max_stack_count - item.count;
                    if(free_count > 0) {
                        const count = Math.min(free_count, srcItem.count);
                        srcItem.count -= count
                        item.count += count;
                        slot.setItem(item);
                        if (srcItem.count === 0) {
                            return
                        }
                    }
                }
            } else {
                console.error(slot);
                throw 'error_invalid_slot_type';
            }
        }
        // 2. проход в поисках свободных слотов
        for(let slot of target_list) {
            if(slot instanceof CraftTableInventorySlot) {
                if(!slot.readonly && !slot.getItem()) {
                    slot.setItem({...srcItem});
                    srcItem.count = 0;
                    break;
                }
            } else {
                throw 'error_invalid_slot_type';
            }
        }
    }

}

// Ячейка рецепта
export class CraftTableRecipeSlot extends CraftTableInventorySlot {

    /**
     * Вызывается после изменения любой из её ячеек
     */
    setItem(item? : IInventoryItem, update_inventory : boolean = true): boolean {
        const res = super.setItem(item, update_inventory)
        if(update_inventory) {
            this.parent.checkRecipe()
        }
        return res
    }

}

export class PaperDollSlot extends CraftTableInventorySlot {
    [key: string]: any;

    constructor(x, y, s, id, ct) {

        super(x, y, s, s, 'lblSlot' + id, null, null, ct, id)

        this.swapChildren(this.children[0], this.children[1])

        const origOnDrop = this.onDrop.bind(this);

        this.onDrop = function(e) {
            const dragItem = e.drag.getItem();
            if(this.isValidDragItem(dragItem)) {
                return origOnDrop(e);
            }
        }
    }

    onSetItem(item : IInventoryItem) {
        // do nothing
    }

    // Make the slot instantly highlighted when we take the item from it
    onMouseDown(e) {
        super.onMouseDown(e)
        this.onMouseEnter(e)
    }

    // // Custom drawing
    // onMouseEnter(e) {
    //     const dragItem = Qubatch.hud.wm.drag.getItem()
    //     if (!dragItem || this.isValidDragItem(dragItem)) {
    //         if(!this.getItem()) {
    //             this.style.background.color = ARMOR_SLOT_BACKGROUND_HIGHLIGHTED
    //         } else {
    //             this.style.background.color = ARMOR_SLOT_BACKGROUND_ACTIVE
    //         }
    //     }
    // }

    // onMouseLeave(e) {
    //     if(!this.getItem()) {
    //         super.onMouseLeave(e)
    //     } else {
    //         this.style.background.color = ARMOR_SLOT_BACKGROUND_HIGHLIGHTED_OPAQUE
    //     }
    // }

    setItem(item: IInventoryItem | null): boolean {
        // this.style.background.color = item ? ARMOR_SLOT_BACKGROUND_HIGHLIGHTED_OPAQUE : '#00000000'
        const resp = super.setItem(item)
        this.onSetItem(item)
        return resp
    }

    isValidDragItem(dragItem) {
        if(!dragItem) {
            return false
        }
        const mat = BLOCK.fromId(dragItem.id)
        return mat?.item?.name == 'armor' && (mat.armor.slot == this.slot_index)
    }

}

export class BaseCraftWindow extends BaseInventoryWindow {

    lblResultSlot   : CraftTableResultSlot
    craft ?         : { slots: CraftTableSlot[] }

    getCraftOrChestSlots(): CraftTableSlot[] {
        return this.craft?.slots ?? []
    }

    /**
    * Итоговый слот (то, что мы получим)
    */
    createResultSlot(x : float, y : float) {
        const ct = this
        const lblResultSlot = this.lblResultSlot = new CraftTableResultSlot(x, y, this.cell_size, this.cell_size, 'lblCraftResultSlot', null, null, ct);
        ct.add(lblResultSlot);
    }

    onShow(args) {
        if(this.inventory_slots) {
            for(let slot of this.inventory_slots) {
                if(slot) {
                    slot.refresh()
                }
            }
        }
        super.onShow(args)
    }

    /**
    * Создание слотов для инвентаря
    */
    createInventorySlots(sz, sx = UI_THEME.window_padding, sy = 166, belt_x? : float, belt_y? : float, draw_potential_slots : boolean = false) {

        if(this.inventory_slots) {
            console.error('createInventorySlots() already created')
            return
        }

        this.inventory_slots  = []
        const xcnt = INVENTORY_HOTBAR_SLOT_COUNT
        sx *= this.zoom
        sy *= this.zoom
        let index = 0
        const margin = UI_THEME.slot_margin * this.zoom
        const padding = UI_THEME.window_padding * this.zoom

        if(belt_x === undefined) {
            belt_x = sx
        } else {
            belt_x *= this.zoom
        }

        if(belt_y === undefined) {
            belt_y = this.h - sz - padding
        } else {
            belt_y *= this.zoom
        }

        //
        const createSlot = (x : float, y : float) => {
            const lblSlot = new CraftTableInventorySlot(x, y, sz, sz, `lblSlot${index}`, null, null, this, index)
            this.add(lblSlot);
            this.inventory_slots.push(lblSlot)
            index++
        }

        // не менять порядок нижних и верхних!
        // иначе нарушится их порядок в массиве ct.inventory_slots
        // нижний ряд (видимые на хотбаре)
        for(let i = 0; i < INVENTORY_HOTBAR_SLOT_COUNT; i++) {
            const x = belt_x + (i % xcnt) * (sz + margin)
            // const y = (sy + 120 * this.zoom) + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom + margin)
            const y = belt_y
            createSlot(x, y)
        }

        // верхние 3 ряда
        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT - INVENTORY_HOTBAR_SLOT_COUNT; i++) {
            const x = sx + (i % xcnt) * (sz + margin)
            const y = sy + Math.floor(i / xcnt) * (sz + margin)
            createSlot(x, y)
        }

        const hud_atlas = Resources.atlas.get('hud')
        // потенциальные, заблокированные слоты
        if(draw_potential_slots) {
            for(let i = INVENTORY_VISIBLE_SLOT_COUNT - INVENTORY_HOTBAR_SLOT_COUNT; i < INVENTORY_VISIBLE_SLOT_COUNT * 2; i++) {
                const x = sx + (i % xcnt) * (sz + margin)
                const y = sy + Math.floor(i / xcnt) * (sz + margin)
                const lblSlot = new Label(x, y, sz, sz, `lblPotentialSlot${i}`)
                lblSlot.setBackground(hud_atlas.getSpriteFromMap('window_slot_locked'))
                this.add(lblSlot)
            }
        }

        // кнопка сортировки
        const ct = this
        const btnSort = new Button(0, 0, 12, 12, 'btnSort')
        btnSort.onMouseDown = function() {
            ct.autoSortItems(true, 4)
        }
        this.add(btnSort)
    }

    /*
    * Слот удаления предметов из инвенторя
    */
    createDeleteSlot(sz: float) {
        const deleteItem = (ct) => {
            const item = ct.inventory.clearDragItem(false)
            ct.world.server.InventoryNewState({
                state: ct.inventory.exportItems(),
                thrown_items: [item],
                delete: true
            })
        }
        const ct = this
        const padding = UI_THEME.window_padding * this.zoom
        const width = 336
        const height = 190
        const form_atlas = new SpriteAtlas()
        const confirm = new Window((this.w - width * this.zoom) / 2, (this.h - height * this.zoom) / 2 - sz, width * this.zoom, height * this.zoom, 'confirm_delete')
        form_atlas.fromFile('./media/gui/popup.png').then(async (atlas : SpriteAtlas) => {
            confirm.setBackground(await atlas.getSprite(0, 0, width * 3, height * 3), 'none', this.zoom / 2.0)
        })
        confirm.z = 1
        confirm.hide()
        this.add(confirm)

        const title = new Label(38 * this.zoom, 25 * this.zoom, 0, 0, `lblConfirmTitle`, '', Lang.delete_item + '?')
        title.style.font.size = UI_THEME.popup.title.font.size
        title.style.font.color = UI_THEME.popup.title.font.color
        confirm.add(title)

        const text = new Label(38 * this.zoom, 60 * this.zoom, 0, 0, `lblConfirmText`, '', Lang.lost_item)
        text.style.font.size = UI_THEME.popup.text.font.size
        text.style.font.color = UI_THEME.popup.text.font.color
        confirm.add(text)

        const hud_atlas = Resources.atlas.get('hud')
        const btnSwitch = new Label(38 * this.zoom, 140 * this.zoom, 16 * this.zoom, 16 * this.zoom, 'btnSwitch', ' ', '        ' + Lang.do_not_show)
        btnSwitch.style.font.size = UI_THEME.popup.text.font.size
        btnSwitch.style.font.color = '#507ea4'
        btnSwitch.setBackground(hud_atlas.getSpriteFromMap('check_bg'))
        btnSwitch.onDrop = btnSwitch.onMouseDown = function() {
            btnSwitch.toggled = (btnSwitch.toggled) ? false : true
            if (btnSwitch.toggled) {
                btnSwitch.setIcon(hud_atlas.getSpriteFromMap('check'))
            } else {
                btnSwitch.setIcon(null)
            }
        }
        confirm.add(btnSwitch)

        const btnYes = new Button(50 * this.zoom, 90 * this.zoom, 90 * this.zoom, 30 * this.zoom, 'btnOK', Lang.yes)
        btnYes.onDrop = btnYes.onMouseDown = function() {
            confirm.hide()
            deleteItem(ct)
            if (btnSwitch?.toggled) {
                Qubatch.settings.check_delete_item = false
                Qubatch.settings.save()
            }
        }
        confirm.add(btnYes)
        const btnNo = new Button(185 * this.zoom, 90 * this.zoom, 90 * this.zoom, 30 * this.zoom, 'btnNo', Lang.no)
        btnNo.onDrop = btnNo.onMouseDown = function() {
            ct.inventory.clearDragItem(true)
            confirm.hide()
        }
        confirm.add(btnNo)

        const delete_slot = new Label(this.w - 2 * sz, this.h - sz - padding, sz, sz, `lblDeleteSlot`)
        delete_slot.setBackground(hud_atlas.getSpriteFromMap('window_slot'))
        delete_slot.setIcon(hud_atlas.getSpriteFromMap('trashbin'))
        delete_slot.onDrop = function() {
            if (Qubatch.settings.check_delete_item) {
                confirm.show()
            } else {
                deleteItem(ct)
            }
        }
        this.add(delete_slot)
    }

    /** @return the list of items from drag and craft slots that couldn't be cleared */
    clearCraft(): IInventoryItem[] | null {
        const remainingItems: IInventoryItem[] = []
        // Drag
        const remainingDragItem = this.inventory.clearDragItem(true)
        if (remainingDragItem) {
            remainingItems.push(remainingDragItem)
        }
        // Clear result
        this.lblResultSlot.setItem(null);
        //
        for(let slot of this.craft.slots) {
            const item = slot?.getItem()
            if (item) {
                if (!this.inventory.incrementAndReorganize(item, true)) {
                    remainingItems.push(item)
                }
                slot.setItem(null)
            }
        }
        // Redraw inventory slots
        this.inventory_slots?.forEach(slot => slot.refresh())
        this.fixAndValidateSlots('clearCraft')
        return remainingItems.length ? remainingItems : null
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
                item.count -= ArrayOrScalar.get(count, i)
                slot.setItem(item)
            }
        }
        this.fixAndValidateSlots('getUsedItemsKeysAndDecrement')
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
        const inventory = Qubatch.player.inventory
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
            // Find pattern slots that we can increment by 1, taking into account the items already placed.
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
            const hasResources = inventory.hasResources(needResources);
            if (// if we can't increment every slot that needs it
                hasResources.missing.length ||
                // or there is no change
                hasResources.has.length === 0
            ) {
                this.fixAndValidateSlots('autoRecipe')
                return;
            }
            // Here the slots may contain: pattern items, empty items that should be set according to the pattern,
            // and garbage that we couldn't clear because there is no space.

            // Put the found resources into the slots
            for (const r of hasResources.has) {
                const inventoryIndex = r.item_index
                // increment the slot item
                const slot = this.craft.slots[r.key]
                let item = slot.getItem()
                if (item == null) {
                    const inventoryItem = inventory.items[inventoryIndex]
                    item = { ...inventoryItem, count: 0 }
                }
                item.count++
                slot.setItem(item)
                // decrement the inventory item
                inventory.decrementByIndex(inventoryIndex)
                this.inventory_slots[inventoryIndex].setItem(inventory.items[inventoryIndex])
            }
        } while (shiftKey);
        this.fixAndValidateSlots('autoRecipe')
    }

    // слоты помощи в крафте
    // addHelpSlots() {
    //     const size = this.area.size.width
    //     const sx = (size == 2) ? 196 : 60.5
    //     const sy = (size == 2) ? 36 : 34.5
    //     this.help_slots = []
    //     for (let i = 0; i < size; i++) {
    //         for (let j = 0; j < size; j++) {
    //             const slot = new HelpSlot((sx + 36 * j) * this.zoom, (sy + 36 * i) * this.zoom, 32 * this.zoom, 'help_' + i + '_' + j, this);
    //             this.help_slots.push(slot)
    //             this.add(slot)
    //         }
    //     }
    // }

    // слоты помощи в крафте
    addHelpSlots(sx : float, sy : float, sz : float, szm : float) {
        const size = this.area.size.width
        this.help_slots = []
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const slot = new HelpSlot((sx + szm * j), (sy + szm * i), sz, `help_${i}_${j}`, this)
                this.help_slots.push(slot)
                this.add(slot)
            }
        }
    }

    // показываем помощь
    setHelperSlots(recipe) {
        const size = this.area.size.width
        for (let i = 0; i < size * size; i++) {
            this.help_slots[i].setItem(null)
        }

        // Show or hide slots
        this.craft?.slots.map(slot => slot.visible = !recipe)
        this.help_slots.map(slot => slot.visible = !!recipe)

        if (recipe) {
            const adapter = recipe.adaptivePatterns[size][0];
            if (adapter) {
                for (let i = 0; i < adapter.array_id.length; i++) {
                    const ids = adapter.array_id[i];
                    this.help_slots[i + adapter.start_index].setItem(ids ? ids[0] : null)
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