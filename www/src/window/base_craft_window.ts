import {BLOCK} from "../blocks.js";
import {ArrayHelpers, ObjectHelpers, ArrayOrScalar, StringHelpers} from "../helpers.js";
import {INVENTORY_DRAG_SLOT_INDEX, MOUSE, HOTBAR_LENGTH_MAX, INVENTORY_CRAFT_INDEX_MIN, BAG_END, PAPERDOLL_CONTAINERS_SLOTS} from "../constant.js";
import {InventorySize} from "../inventory.js";
import { Label, SimpleBlockSlot, Window, Button, ToggleButton } from "../ui/wm.js";
import {Recipe, TUsedCraftingRecipe} from "../recipes.js";
import { InventoryComparator } from "../inventory_comparator.js";
import {BaseAnyInventoryWindow, BaseInventoryWindow} from "./base_inventory_window.js"
import { Enchantments } from "../enchantments.js";
import { getBlockImage } from "./tools/blocks.js";
import type { PlayerInventory } from "../player_inventory.js";
import type {SpriteAtlas} from "../core/sprite_atlas.js";
import { Resources } from "../resources.js";
import type {Hotbar} from "../hotbar.js";
import { Lang } from "../lang.js";
import type {TMouseEvent} from "../vendors/wm/wm.js";
import type {GameClass} from "../game.js";
import type {AnvilResultSlot} from "./anvil.js";
import {CHEST_CHANGE} from "../chest.js";

const ARMOR_SLOT_BACKGROUND_HIGHLIGHTED = '#ffffff55'
const ARMOR_SLOT_BACKGROUND_HIGHLIGHTED_OPAQUE = '#929292FF'
const ARMOR_SLOT_BACKGROUND_ACTIVE = '#828282ff'
const DOUBLE_CLICK_TIME = 300.0;

export class HelpSlot extends Label {

    hud_atlas : SpriteAtlas
    item ?      : int | null
    block ?     : IBlockMaterial | null

    constructor(x : float, y : float, sz : float, id : string, ct : Window) {
        super(x, y, sz, sz, id, null, null)
        this.z = -1 // под основными слотами, чтобы не перехватывать события мыши
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
            return this.block.title + ` (#${this.item})`
        }
        return null
    }

}

export type TTableSlotContext = BaseAnyInventoryWindow | Hotbar

/**
 * Базовый класс для почти любого слота в игре, кроме {@link Pointer}.
 *
 * Ранее назывался CraftTableSlot - но это название путает, т.к. в большинстве случаев не имеет отношения к крафту.
 *
 * Смысл имени: "табличный слот", т.е. слот из какой-то таблицы слотов (на форме).
 */
export class TableSlot extends SimpleBlockSlot {

    declare parent: TTableSlotContext
    ct: TTableSlotContext

    /**
     * Индекс этго слота в {@link slot_source}.
     * Если это значение задано, то слот сам не хранит предмет, а использует значение из {@link slot_source}
     */
    readonly slot_index?: int | null
    /**
     * Струетура данных, харнящая предмет этого слота по индексу {@link slot_source}.
     * Если пусто {@link slot_index} задано, но это значение пусто - то это предметы инвентаря.
     */
    readonly slot_source?: (IInventoryItem | null)[] | null

    /**
     * @param slot_source - структура данных, содержащая предметы, включая предмет этого слота.
     *  Имеет значение тоолько если {@link slot_index} задан. По умолчанию - инвентарь.
     */
    constructor(x: float, y: float, w: float, h: float,
                id: string, title: string, text: string, ct: TTableSlotContext,
                slot_index?: int | null, slot_source?: (IInventoryItem | null)[] | null
    ) {
        super(x, y, w, h, id, null, '')
        this.ct = ct

        this.slot_index = slot_index
        if (slot_index != null) {
            this.slot_source = slot_source
        } else {
            if (slot_source) {
                throw new Error() // нерпавильные аргументы
            }
        }
        if (this.isInventorySlot()) {
            ct.inventory.addInventorySlot(this)
        }
        // this.style.background.color = '#00000011'
        // this.style.border.color = '#00000033'
        this.style.border.hidden = true
        // this.style.border.style = 'inset'
    }

    //
    get tooltip() {
        if (this.locked) {
            return
        }
        let resp = null;
        const item = this.getItem();
        if(item) {
            if(item.id) {
                const block = BLOCK.fromId(item.id)
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
                if (block.extra_data?.slot) {
                    resp += '\r' + Lang['backpack'] + ' (' + Lang['slots'] + ': ' + block.extra_data.slot + ')'
                }
                if (block.extra_data?.hotbar) {
                    resp += '\r' + Lang['toolbelt'] + ' (' + Lang['slots'] + ': ' + block.extra_data.hotbar + ')'
                }
            }
        }
        return resp
    }

    isInventorySlot(): boolean {
        return this.slot_index != null && this.slot_source == null
    }

    /** @returns true если слот в сумке (хотбаре или рюкзаке) */
    isBagSlot(): boolean {
        return this.isInventorySlot() && this.slot_index < BAG_END
    }

    get item(): IInventoryItem | null {
        return this.slot_index != null
            ? (this.slot_source ?? this.ct.inventory.items)[this.slot_index] ?? null
            : this._item ?? null
    }

    /**
     * Устанавливает предмет и выполняет все действия в интерфейсе связанные с измененем
     * (обновляет все что нужно).
     *
     * Для добавления эффектов при изменения предмета, переопределять не этот метод, а {@link onChange}
     */
    setItem(item: IInventoryItem | null): void {
        const slot_index = this.slot_index
        const inventory = this.ct.inventory

        // пофиксить пердмет
        if (item && item.count <= 0) {
            if (item.count < 0) {
                window.alert('item.count < 0')
            }
            item = null
        }

        // определеить изменилось ли что-то существенное в предмете
        const changed = !ObjectHelpers.deepEqual(this._item, item)

        // обновить данные
        if (slot_index != null) {
            const slot_source = this.slot_source ?? inventory.items
            slot_source[slot_index] = item
            if (changed) {
                this._item = item && {...item} // неглубокая копия используемая только для сравнений основных свойств
            }
        } else {
            this._item = item
        }

        // обработать сопутствующие изменения
        if (changed) {
            this.onChange()
        }
        this.refresh()
    }

    /**
     * Вызывается после того, как предмет изменился, только если новый предмет отлиается
     * от неглубокой копии прошлого предмета.
     */
    protected onChange(): void {
        // ничего, определено в подклассах
    }

    getInventory() : PlayerInventory {
        return this.ct.inventory
    }

    dropIncrementOrSwap(e: TMouseEvent): void {
        const player    = Qubatch.player;
        const drag      = e.drag;
        // @todo check instanceof!
        // if(dropData instanceof InventoryItem) {
        let dropItem  = drag.item
        if(!dropItem) {
            return
        }
        if(drag && drag.slot === this) {
            drag.slot = null
            return
        }
        const max_stack_count = BLOCK.getItemMaxStack(dropItem)
        // Если в текущей ячейке что-то есть
        const targetItem = this.item
        if(targetItem) {
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
                    }
                    this.setItem(targetItem)
                }
            } else {
                // поменять местами перетаскиваемый элемент и содержимое ячейки
                this.setItem(dropItem)
                dropItem = targetItem
            }
        } else {
            // Перетаскивание в пустую ячейку
            if(e.button_id == MOUSE.BUTTON_RIGHT && dropItem.count > 1) {
                this.setItem({...dropItem, count: 1})
                dropItem.count--;
            } else {
                this.setItem(dropItem);
                dropItem = null
            }
        }
        // обновить драг слот
        if (dropItem?.count === 0) {
            dropItem = null
        }
        drag.setItem(dropItem)
        player.inventory.items[INVENTORY_DRAG_SLOT_INDEX] = dropItem

        this.ct.fixAndValidateSlots('TableSlot dropIncrementOrSwap')
    }

}

//
export class CraftTableResultSlot extends TableSlot {

    slot_empty      = 'window_slot_locked'
    used_recipes    : TUsedCraftingRecipe[] = []
    recipe          : Recipe | null = null

    constructor(x, y, w, h, id, title, text, ct) {
        super(x, y, w, h, id, title, text, ct, null);
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
        const used_items_keys = this.untypedParent.getUsedItemsKeysAndDecrement(1);
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
        this.untypedParent.checkRecipe();
        this.untypedParent.fixAndValidateSlots('CraftTableResultSlot useRecipe')
    }

    // setupHandlers...
    setupHandlers() {

        let that = this;

        // onDrop
        this.onDrop = function(e: TMouseEvent) {
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
            this.parent.onInventoryChange('CraftTableResultSlot onDrop')
        }

        // Drag & drop
        this.onMouseDown = function(e: TMouseEvent) {
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
            this.parent.inventory.setDragItem(this, dragItem);
            this.parent.onInventoryChange('CraftTableResultSlot onMouseDown')
        }

    }

}

/**
 * Любой слот, ссыоающийся на реальные данные (в инвентаре или сундуке).
 *
 * Ранее назывался CraftTableInventorySlot, но это название запутывает, т.к. этот слот может
 * не иметь отношения ни к крафту (просто в инвентаре), ни к инвентарю (слот сундука).
 *
 * Другие подклассы {@link TableSlot} не содержат реальных предметов.
 */
export class TableDataSlot extends TableSlot {

    prev_mousedown_time = -Infinity
    prev_mousedown_button: int

    constructor(x : float, y : float, w : float, h : float,
                id : string, title : string, text : string, ct : TTableSlotContext,
                slot_index : int, slot_source?: (IInventoryItem | null)[] | null, options: Dict | null = null
    ) {

        super(x, y, w, h, id, title, text, ct, slot_index, slot_source)

        this.options = options || {}

        // if slot is readonly
        if(!this.readonly) {

            // Drop
            this.onDrop = function(e: TMouseEvent) {

                if (this.options.disableIfLoading && this.ct.loading || this.locked) {
                    return
                }
                const player      = (Qubatch as GameClass).player
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
                        const list: {chest: int, index: int, item: IInventoryItem}[] = [];
                        // проверить крафт слоты или слоты сундука
                        const craftSlots: TableSlot[] = this.parent.getCraftOrChestSlots()
                        for(let i = 0; i < craftSlots.length; i++) {
                            const item = craftSlots[i]?.item
                            if (InventoryComparator.itemsEqualExceptCount(item, dropItem)) {
                                list.push({chest: 1, index: i, item: item})
                            }
                        }
                        // проверить слоты инвентаря
                        const inventory_items = player.inventory.items
                        const size = player.inventory.getSize()
                        for(const i of size.backpackHotbarIndices()) {
                            const item = inventory_items[i]
                            if (InventoryComparator.itemsEqualExceptCount(item, dropItem)) {
                                list.push({chest: 0, index: i, item: item})
                            }
                        }
                        list.sort(function(a, b){
                            let t = a.item.count - b.item.count;
                            if (t != 0) {
                                return t
                            }
                            return (a.index - b.index) - 1000 * (a.chest - b.chest);
                        })
                        for(let v of list) {
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
                                craftSlots[v.index].setItem(item)
                            } else {
                                player.inventory.items[v.index] = item
                            }
                            if (this.parent.lastChange) { // present in chests, not in craft windows
                                this.parent.lastChange.type = CHEST_CHANGE.MERGE_SMALL_STACKS;
                            }
                        }
                        this.ct.onInventoryChange('TableDataSlot onDrop doubleClick')
                        return
                    }
                }

                this.dropIncrementOrSwap(e)
                this.ct.onInventoryChange('TableDataSlot onDrop')
            }

        }

        // TODO: pixi
        this.refresh()
    }

    // Custom drawing
    // onMouseEnter(e) {
    //     if (this.options.disableIfLoading && this.ct.loading) {
    //         return
    //     }
    //     // this.style.background.color = this.options.onMouseEnterBackgroundColor ?? '#ffffff55'
    // }

    // onMouseLeave(e) {
    //     // don't disable it if loading
    //     // this.style.background.color = '#00000000'
    // }

    // Mouse down
    onMouseDown(e: TMouseEvent) {

        if (this.options.disableIfLoading && this.ct.loading || this.locked) {
            return
        }

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
            this.setItem(targetItem);
            this.ct.fixAndValidateSlots('TableDataSlot right button')
        } else {
            if(e.shiftKey) {
                const parent = this.parent as BaseCraftWindow
                switch(this.parent.id) {
                    case 'frmCharacterWindow':
                    case 'frmInventory': {
                        const {bagEnd, hotbar} = this.getInventory().getSize()
                        // сначала пробуем переместить в слоты брони
                        if(!this.appendToSpecialList(targetItem, parent.inventory_slots)) {
                            // если слот не в рюкзаке - то перемещаем в рюкзак. Иначе - в хотбар
                            let targetList = this.slot_index <= hotbar || this.slot_index > bagEnd
                                ? parent.bag_slots.slice(HOTBAR_LENGTH_MAX, bagEnd)
                                : parent.bag_slots.slice(0, hotbar)
                            this.appendToList(targetItem, targetList)
                        }
                        this.setItem(targetItem)
                        this.ct.fixAndValidateSlots('TableDataSlot shiftKey frmInventory')
                        break;
                    }
                    case 'frmAnvil':
                    case 'frmBarrel':
                    case 'frmChest':
                    case 'frmDoubleChest':
                    case 'frmEnderChest':
                    case 'frmFurnace':
                    case 'frmChargingStation':
                    case 'frmCraft': { // для всех окон где с одной строны сумка, а с другой - сундук/крафт
                        if (parent.loading) {
                            break // не разрешить для сундуков которые еще грузятся
                        }
                        // из сумки перемещаем в крафт/сундук, иначе - в сумку
                        const targetList = this.isBagSlot()
                            ? parent.getCraftOrChestSlots()
                            : parent.bag_slots
                        this.appendToList(targetItem, targetList)
                        this.setItem(targetItem)
                        if (parent.lastChange) { // для сундуков - запомнить этот тип изменения
                            parent.lastChange.type = CHEST_CHANGE.SHIFT_SPREAD
                        }
                        this.ct.fixAndValidateSlots('TableDataSlot CHEST_CHANGE.SHIFT_SPREAD')
                        break
                    }
                    default: {
                        console.log('this.parent.id', this.untypedParent.id)
                    }
                }
                this.ct.onInventoryChange('TableDataSlot onMouseDown shiftKey')
                return
            }
            dragItem = targetItem
            this.setItem(null)
        }
        this.getInventory().setDragItem(this, dragItem)
        this.prev_mousedown_time = performance.now()
        this.prev_mousedown_button = e.button_id
        this.ct.onInventoryChange('TableDataSlot onMouseDown')
    }

    get readonly() {
        return !!this.options.readonly;
    }

    /**
     * Пытается переместить предмет в один из слотов типа {@link PaperDollSlot} в указанном спике
     * @param srcItem Исходный слот для перемещения
     * @param target_list Итоговый список слотов, куда нужно переместить исходный слот
     */
    appendToSpecialList(srcItem: IInventoryItem, target_list: TableDataSlot[]): boolean {
        const srcBlock = BLOCK.fromId(srcItem.id)
        // 0. Поиск специализированных слотов брони
        for(let slot of target_list) {
            if(slot instanceof PaperDollSlot && srcBlock.armor && slot.slot_index == srcBlock.armor.slot) {
                const item = slot.getItem();
                if(!slot.locked && !slot.readonly && !item) {
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
    appendToList(srcItem: IInventoryItem, target_list: TableSlot[]) {
        if (srcItem.count === 0) {
            return
        }
        const max_stack_count = BLOCK.getItemMaxStack(srcItem);
        // 1. проход в поисках подобного
        for(let slot of target_list) {
            const item = slot.item
            if(!slot.locked && !slot.readonly && InventoryComparator.itemsEqualExceptCount(item, srcItem)) {
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
        }
        // 2. проход в поисках свободных слотов
        // если это инвентарь - то сначала проходим по инвентарю, а потом по хотабру. Иначе - по порядку
        const slotsSize = target_list === this.untypedParent.bag_slots
            ? this.getInventory().getSize()
            : new InventorySize().setFake(target_list.length)
        for(const i of slotsSize.backpackHotbarIndices()) {
            const slot = target_list[i]
            if(!slot.locked && !slot.readonly && !slot.item) {
                slot.setItem({...srcItem});
                srcItem.count = 0;
                break;
            }
        }
    }

}

export class PaperDollSlot extends TableDataSlot {

    get untypedParent(): BaseCraftWindow {
        return this.parent as any;
    }


    //onSetItem = (item : IInventoryItem) => {}

    constructor(x, y, s, id, ct) {

        super(x, y, s, s, 'lblSlot' + id, null, null, ct, id)

        this.swapChildren(this.children[0], this.children[1])

        const origOnDrop = this.onDrop.bind(this);

        this.onDrop = function(e: TMouseEvent) {
            const dragItem = e.drag.getItem();
            if(this.isValidDragItem(dragItem)) {
                return origOnDrop(e);
            }
        }
    }

    // Make the slot instantly highlighted when we take the item from it
    onMouseDown(e: TMouseEvent) {
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

    protected onChange(): void {
        super.onChange()

        // this.style.background.color = item ? ARMOR_SLOT_BACKGROUND_HIGHLIGHTED_OPAQUE : '#00000000'

        // попробовать переложить из несуществующих слотов слотов
        if (PAPERDOLL_CONTAINERS_SLOTS.includes(this.slot_index)) {
            const inventory = this.getInventory()
            inventory.moveFromSlots(false, inventory.getSize().invalidIndices())
        }

        /* Отправить изменениие на сервер по двум причинам:
        1. Обновить броню.
        2. Только для пояса и рюкзака: если мы положили предмет, увеличивший число слотов, то возможно
          клиент начнет слать серверу CMD_DROP_ITEM_PICKUP на предметы, которые он теперь может поднять.
          Но у сервера все еще старый размер инвентаря и он не может поднять предмет, это приводит к странностям.
          Чтобы сразу начать поднимать, нужно отправить состояние.
        */
        this.ct.sendInventory({ allow_temporary: true })
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

    lblResultSlot ? : CraftTableResultSlot | AnvilResultSlot
    craft ?         : { slots: TableSlot[] }
    craft_area?: {
        size: {
            width: int
            height: int
        }
    }
    help_slots      : HelpSlot[]

    /** Создание слотов для крафта */
    protected createCraft(x0: float, y0: float, size: float, step: float, countX: int, countY: int): void {

        if(this.craft) {
            console.error('error_inventory_craft_slots_already_created')
            return
        }

        this.craft = {
            slots: new Array(countX * countY)
        }

        const options = {
            onMouseEnterBackgroundColor: '#ffffff33'
        }
        for(let i = 0; i < this.craft.slots.length; i++) {
            const x = x0 + (i % countX) * step
            const y = y0 + Math.floor(i / countX) * step
            const lblSlot = new TableDataSlot(x, y, size, size,
                'lblCraftRecipeSlot' + i, null, null, this,
                INVENTORY_CRAFT_INDEX_MIN + i, null, options)
            this.craft.slots[i] = lblSlot
            this.add(lblSlot)
        }

        /* Этот код ничего не делает, но его зачем-то оставили

        const locked_slots = [
            // {x: sx - szm, y: sy},
            // {x: sx - szm, y: sy + szm},
            // {x: sx + szm * 2, y: sy},
            // {x: sx + szm * 2, y: sy + szm},
        ]

        for(let i = 0; i < locked_slots.length; i++) {
            const ls = locked_slots[i]
            const lbl = new Label(ls.x, ls.y, sz, sz, `lblLocked_${i}`)
            lbl.setBackground(this.hud_atlas.getSpriteFromMap('window_slot_locked'))
            this.add(lbl)
        }
        */

    }

    getCraftOrChestSlots(): TableSlot[] {
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

    /** Очищает крфат слоты если это возможно. */
    clearCraft(): void {
        const inventory = this.inventory
        inventory.moveFromSlots(false, inventory.getSize().craftIndices())
        inventory.refresh()
        this.fixAndValidateSlots('clearCraft')
    }

    // Returns used_items (an array item comparison keys - to send to the server), and decrements craft slots
    getUsedItemsKeysAndDecrement(count): string[] {
        const result: string[] = [];
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

    //
    getCurrentSlotsSearchPattern() {
        const item_ids = [];
        for(let slot of this.craft.slots) {
            const item = slot.getItem();
            item_ids.push(item?.id || null);
        }
        return Recipe.craftingSlotsToSearchPattern(item_ids, this.craft_area.size);
    }

    // Автоматически расставить рецепт в слотах по указанному рецепту
    autoRecipe(recipe: Recipe, shiftKey: boolean): boolean {
        const inventory = Qubatch.player.inventory
        // Validate area size
        if(recipe.size.width > this.craft_area.size.width) {
            return false;
        }
        if(recipe.size.height > this.craft_area.size.height) {
            return false;
        }
        const searchPattern = this.getCurrentSlotsSearchPattern();
        // Search for a best matching pattern
        let pattern = recipe.findAdaptivePattern(searchPattern);
        if (!pattern) {
            this.clearCraft()
            // if we can't find the exact match, use the 1st pattern
            pattern = recipe.adaptivePatterns[this.craft_area.size.width][0];
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
                const srcInventoryIndex = r.item_index
                // increment the slot item
                const slot = this.craft.slots[r.key]
                const srcItem = inventory.items[srcInventoryIndex]
                const item = slot.item ?? { ...srcItem, count: 0 }
                item.count++
                slot.setItem(item)
                // decrement the inventory item
                inventory.decrementByIndex(srcInventoryIndex)
            }
        } while (shiftKey);
        this.onInventoryChange('autoRecipe')
    }

    // слоты помощи в крафте
    addHelpSlots(sx : float, sy : float, sz : float, szm : float) {
        const size = this.craft_area.size
        this.help_slots = []
        for (let i = 0; i < size.width; i++) {
            for (let j = 0; j < size.height; j++) {
                const slot = new HelpSlot((sx + szm * j), (sy + szm * i), sz, `help_${i}_${j}`, this)
                this.help_slots.push(slot)
                this.add(slot)
            }
        }
    }

    // показываем помощь
    setHelperSlots(recipe: Recipe | null): void {
        const size = this.craft_area.size.width
        for (let i = 0; i < size * size; i++) {
            this.help_slots[i].setItem(null)
        }

        // помощь видна если есть рецепт, или нет ни одного предмета в крафт слотах
        const helpVisible = !!recipe && (this.craft.slots.find(slot => slot.item) == null)
        this.help_slots.forEach(slot => slot.visible = helpVisible)

        if (helpVisible) {
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

    onInventoryChange(context?: string): void {
        if (this.craft_area) {
            this.checkRecipe()
            // если есть любой предмет в крафте - скрыть помощь
            if (this.craft.slots.find(slot => slot.item)) {
                this.setHelperSlots(null)
            }
        }
        super.onInventoryChange(context)
    }

}