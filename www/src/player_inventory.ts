import {RecipeManager} from "./recipes.js";
import {Inventory, TInventoryState, TInventoryStateChangeParams} from "./inventory.js";
import {HOTBAR_LENGTH_MAX, INVENTORY_DRAG_SLOT_INDEX, INVENTORY_SLOT_COUNT} from "./constant.js";
import type {WindowManager, Pointer} from "./vendors/wm/wm.js";
import type {Player} from "./player.js";
import type {HUD} from "./hud.js";
import type {InventoryWindow} from "./window/index.js";
import type {CraftTableSlot} from "./window/base_craft_window.js";
import {InventoryComparator} from "./inventory_comparator.js";
import type {SimpleBlockSlot} from "./vendors/wm/wm.js";

/**
 * A client version of {@link Inventory}.
 * Maybe rename it into ClientInventory for clarity.
 */
export class PlayerInventory extends Inventory {

    wm: WindowManager
    hud: HUD
    recipes: RecipeManager
    private _update_number      = 0
    private inventory_ui_slots : SimpleBlockSlot[] = []

    constructor(player: Player, state: TInventoryState, hud: HUD) {
        super(player, {current: {index: 0, index2: -1}, items: []});
        this.hud = hud
        for(let i = 0; i < INVENTORY_SLOT_COUNT; i++) {
            this.items.push(null);
        }
        //
        this.select(this.current.index);
        // Recipe manager
        this.recipes = new RecipeManager(true);
        // Restore slots state
        this.setState(state);
        // Action on change slot
        this.onSelect = (item) => {
            // Вызывается при переключении активного слота в инвентаре
            player.resetMouseActivity();
            player.world.server.InventorySelect(this.current);

            // strings
            const strings = Qubatch.hotbar.strings
            if(item) {
                const itemTitle = player.world.block_manager.getBlockTitle(item)
                strings.updateText(0, itemTitle)
            } else {
                strings.setText(0, null)
            }

            this.hud.refresh();
        };
        // Add this for draw on screen
        Qubatch.hotbar.setInventory(this)
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

    select(index: int): void {
        super.select(index)
        this.update_number++
    }

    setState(inventory_state: TInventoryState) {
        this.current = inventory_state.current;
        this.items = inventory_state.items;
        this.refresh();
        // update drag UI if the dragged item changed
        for(const w of this.hud.wm.visibleWindows()) {
            w.onInventorySetState && w.onInventorySetState();
        }
        this.update_number++
    }

    get inventory_window(): InventoryWindow {
        return this.hud.wm.getWindow('frmInventory');
    }

    // Open window
    open() {
        this.hud.wm.getWindow('frmInGameMain').openTab('frmCharacterWindow')
    }

    // Refresh
    refresh(): true {
        this.player.state.hands.right = this.current_item;
        if(this.hud) {
            this.hud.refresh();
            const frmRecipe = this.player.inventory?.recipes?.frmRecipe || null
            frmRecipe?.paginator.update();
        }
        return true;
    }

    /**
     * Обновляет UI слоты - чтобы изменения {@link items} стали видны.
     *
     * Почему это отдельный метод от {@link refresh}: семантика {@link refresh} не определена,
     * но т.к. раньше он не обновлял слоты, то возможно и не должен. Добавили новый метод,
     * чтобы не добавить возможно нежелательне эффекты к старому.
     */
    refreshUISlots(): void {
        for(const slot of this.inventory_ui_slots) {
            slot.refresh()
        }
    }

    /**
     * @param width - unused, TODO remove
     * @param height - unused, TODO remove
     */
    setDragItem(slot: CraftTableSlot, item: IInventoryItem | null, drag: Pointer | null, width?, height?): void {
        this.items[INVENTORY_DRAG_SLOT_INDEX] = item;
        drag ??= this.hud.wm.drag
        if(item) {
            drag.setItem(item, slot)
        } else {
            this.clearDragItem()
        }
    }

    /**
     * The same result as in chest_manager.js: applyClientChange()
     * @return the item, if it hasn't been move to the inventory completely
     */
    clearDragItem(move_to_inventory : boolean = false): IInventoryItem | null {
        const drag: Pointer = this.hud.wm.drag
        let dragItem: IInventoryItem | null = drag.getItem()
        if(dragItem && move_to_inventory) {
            if (this.incrementAndReorganize(dragItem, true)) {
                dragItem = null
            }
        }
        this.items[INVENTORY_DRAG_SLOT_INDEX] = null
        drag.clear()
        return dragItem
    }

    /**
     * Tries to move items between slots to free space.
     * It doesn't remove from HUD slots, but may add to them.
     *
     * It's not optimized, but it doesn't have to be.
     *
     * @return the index of a slot that has been freed, or -1 if no slots have been freed
     */
    private reorganizeFreeSlot(): int {
        const bm     = this.block_manager
        const items  = this.items
        const size = this.getSize()
        const simpleKeys = new Array<string>(size.bagEnd)
        const freeSpaceByKey: Dict<int> = {} // total free space in all stacks of this type of item

        for(const i of size.bagIndices()) {
            const item = items[i]
            if (item) {
                const key = InventoryComparator.makeItemCompareKey(item)
                simpleKeys[i] = key
                const thisItemFreeSpace = bm.getItemMaxStack(item) - item.count
                freeSpaceByKey[key] = (freeSpaceByKey[key] ?? 0) + thisItemFreeSpace
            }
        }

        // for each slot that can be freed. It excludes HUD slots
        for(let i = HOTBAR_LENGTH_MAX; i < size.bagEnd; i++) {
            const item = items[i]
            if (!item) {
                continue
            }
            // check if this item can be completely moved to partially other filled slots
            const key = simpleKeys[i]
            const thisItemFreeSpace = bm.getItemMaxStack(item) - item.count
            const otherItemsFreeSpace = freeSpaceByKey[key] - thisItemFreeSpace
            if (item.count > otherItemsFreeSpace) {
                continue
            }
            // move the item to other slots
            this.items[i] = null // do it before incrementing, so it won't add to itself
            if (!this.increment(item, true) || items[i]) {
                // this should not happen, because we know there is enough free space in partially filled slots
                throw new Error()
            }
            return i
        }
        return -1
    }

    /**
     * Similar to Inventory.increment, but if it can't add the item,
     * it may also combine some incomplete stacks (excluding HUD slots) to free a slot
     * and move the item into it. Updates count in {@link mat}.
     * @return true if anything changed
     */
    incrementAndReorganize(item: IInventoryItem, no_update_if_remains?: boolean): boolean {
        let result = this.increment(item, no_update_if_remains, true)
        if (item.count) {
            const slotIndex = this.reorganizeFreeSlot()
            if (slotIndex >= 0) {
                this.items[slotIndex] = {...item}
                item.count = 0
                this.refresh()
                result = true
            }
        }
        return result
    }

    moveFromInvalidSlotsIfPossible(): void {
        let changed = false
        const items = this.items
        for(const i of this.getSize().invalidIndices()) {
            if (items[i] && this.incrementAndReorganize(items[i], true)) {
                items[i] = null
                changed = true
            }
        }
        if (changed) {
            this.refreshUISlots()
        }
    }

    /**
     * Если дарг слот пуст, и текущее число слотов сумки больше чем {@link prevBagSize}
     * (полученного из {@link InventorySize.bagSize}), то отиправляет состояние на сервер.
     *
     * Зачем это:
     * если мы положили предмет, увеличивший число слотов, то возможно клиент начнет слать серверу
     * CMD_DROP_ITEM_PICKUP на предметы, которые он теперь может поднять. Но у сервера все еще старый
     * размер инвентаря и он не может поднять предмет, это приводит к странностям.
     * Чтобы сразу начать поднимать, нужно отправить состояние.
     * Сделаем это только если дроп пуст (чтобы не очищать его неожиданно для игрока)
     */
    sendStateIfSizeIncreases(prevBagSize: int): void {
        if (!this.items[INVENTORY_DRAG_SLOT_INDEX] && this.getSize().bagSize > prevBagSize) {
            this.sendStateChange()
        }
    }

    /**
     * Отправляет состояние на сервер. Пытается пренести предметы из драг слота и несуществующих слотов
     * в существующие, иначе выбасывает их.
     */
    sendStateChange(params: TInventoryStateChangeParams = {}): void {
        const size = this.getSize()
        const items = this.items
        const thrown_items = params.thrown_items ?? []

        const dragItem = this.clearDragItem(true)
        if (dragItem) {
            thrown_items.push(dragItem)
        }

        for(const i of size.invalidIndices()) {
            const item = items[i]
            if (item) {
                // добавить предмет к существующим слотам (пыстым или нет). Возможно, переложить другие предметы чтобы освободить место.
                this.incrementAndReorganize(item)
                // если еще осталось - выкинуть
                if (item.count) {
                    thrown_items.push(item)
                }
                items[i] = null
            }
        }

        this.player.world.server.InventoryNewState({
            state: this.exportItems(),
            ...params
        })
    }

    /**
     * @returns true если может поднять целиком хотя бы 1 из педметов. На сервере проверяется так же,
     *   см. обработчик {@link ServerClient.CMD_DROP_ITEM_PICKUP}
     */
    canPickup(items: (IInventoryItem | IBlockItem)[]) : boolean {
        const hasDrag = this.items[INVENTORY_DRAG_SLOT_INDEX] != null
        for (const item of items) {
            const max_stack = this.block_manager.getItemMaxStack(item)
            let count = item.count

            // Допустим, инвентарь был полон, а мы только что взяли из него предмет и держим его мышью.
            // Место осободилось, но сервер об этом не знает, и если мы поднимем с земли, может быть некуда
            // деть драг слот. Чтобы этого избежать, проверяем что есть дополнительный свободный стек.
            if (hasDrag) {
                count += max_stack
            }

            for (const i of this.getSize().bagIndices()) {
                const exItem = this.items[i]
                if (!exItem) {
                    count -= max_stack
                    if (count <= 0) {
                        return true
                    }
                } else if (InventoryComparator.itemsEqualExceptCount(exItem, item)) {
                    count -= Math.max(max_stack - exItem.count)
                    if (count <= 0) {
                        return true
                    }
                }
            }
        }
        return false
    }
}