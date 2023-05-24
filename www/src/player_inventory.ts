import {RecipeManager} from "./recipes.js";
import {Inventory, TInventoryState, TInventoryStateChangeParams} from "./inventory.js";
import {INVENTORY_DRAG_SLOT_INDEX, INVENTORY_SLOT_COUNT, PAPERDOLL_END, PAPERDOLL_MIN_INDEX} from "./constant.js";
import type {WindowManager, Pointer} from "./vendors/wm/wm.js";
import type {HUD} from "./hud.js";
import type {TableSlot} from "./window/base_craft_window.js";
import {InventoryComparator} from "./inventory_comparator.js";
import {ObjectHelpers} from "./helpers/object_helpers.js";
import type {Player} from "./player.js";

/**
 * A client version of {@link Inventory}.
 * Maybe rename it into ClientInventory for clarity.
 */
export class PlayerInventory extends Inventory {

    declare player: Player
    wm: WindowManager
    hud: HUD
    recipes = new RecipeManager()
    recipesLoadPromise = this.recipes.load()
    private _update_number  = 0 // используется хотбаром чтобы понять изменился ли инвентарь
    /** Все слоты, ссылающиеся на инвентарь, во всех окнах (кроме хотабара). */
    private inventory_ui_slots: TableSlot[] = []

    /**
     * Копии предметов глубиной 1 (со своим count, но общими полями внтури extra_data),
     * используемая чтобы обнаружить изменения
     */
    private prevItems?: (IInventoryItem | null)[]

    constructor(player: Player, state: TInventoryState, hud: HUD) {
        super(player, {current: {index: 0, index2: -1}, items: []});
        this.hud = hud
        for(let i = 0; i < INVENTORY_SLOT_COUNT; i++) {
            this.items.push(null);
        }
        // Restore slots state
        this.setState(state);
        // не уверен что это нужно - лишние действия, лишняя команда отслывается. Но пусть будет (так было)
        this.select(this.current.index);
        // Add this for draw on screen
        Qubatch.hotbar.setInventory(this)
    }

    get drag(): Pointer { return this.hud.wm.drag }

    get update_number() {
        return this._update_number
    }

    addInventorySlot(slot: TableSlot): void {
        if (!slot.isInventorySlot()) {
            throw new Error()
        }
        this.inventory_ui_slots.push(slot)
    }

    select(index: int): void {
        super.select(index)
        // часть из того, что было раньше в onSelect (дрегая часть перешла в refreshCurrent)
        this.player.resetMouseActivity();
        this.player.world.server.InventorySelect(this.current);
    }

    next(): void {
        this.select(this.current.index + 1)
    }

    prev(): void {
        this.select(this.current.index - 1)
    }

    setState(inventory_state: TInventoryState) {
        this.current = inventory_state.current;
        this.items = inventory_state.items;
        this.refresh();
        for(const w of this.hud.wm.visibleWindows()) {
            w.onInventoryChange && w.onInventoryChange('setState');
        }
    }

    // Open window
    open() {
        this.hud.wm.getWindow('frmInGameMain').openTab('frmInventory')
    }

    /**
     * Обновляет почти весь UI, зависящий от инвентаря (хотбар, слоты, драг, рецепты, текст в HUD),
     * чтобы изменения {@link items} и {@link current} стали видны.
     *
     * Некоторая логика, специфическая для отдельных окон, реализовано не тут, а в самих окнах - см.
     * {@link BaseAnyInventoryWindow.onInventoryChange}
     */
    refresh(): void {
        // HUD, выбранный предмет

        this.fixCurrentIndexes()

        this._update_number++ // говорит хотбару что надо обновляться

        const current_item = this.current_item
        this.player.state.hands.right = current_item

        // имя текущего предмета в хотбаре
        const strings = this.player.world.game.hotbar.strings
        if(current_item) {
            const itemTitle = this.block_manager.getBlockTitle(current_item)
            strings.updateText(0, itemTitle)
        } else {
            strings.setText(0, null)
        }

        this.hud.refresh()

        // обработать изменения предметов, влияющие на всю игру. Изменения, специфичные для отдельных окон, обрабатываются в них.
        if (this.prevItems) {
            for(let i = PAPERDOLL_MIN_INDEX; i < PAPERDOLL_END; i++) {
                if (!ObjectHelpers.deepEqual(this.items[i], this.prevItems[i])) {
                    this.player.updateArmor()
                    break
                }
            }
        }
        this.prevItems = ObjectHelpers.deepClone(this.items, 2)

        // рецепты на форме рефептов
        const frmRecipe = this.player.windows?.frmRecipe
        if (frmRecipe?.visible) {
            frmRecipe.paginator.update()
        }

        // слоты на всех формах
        let visibleSlotsCount = 0
        const size = this.getSize()
        for(const slot of this.inventory_ui_slots) {
            if (slot.ct.visible) {
                visibleSlotsCount++
                slot.locked = !size.slotExists(slot.slot_index)
                slot.setItem(slot.item)
            }
        }

        // если видно хотя бы одно окно со слотами, то установть видимый перетаскиваемй предмет
        if (visibleSlotsCount) {
            const prevDragItem = this.drag.item
            const newDragItem = this.items[INVENTORY_DRAG_SLOT_INDEX]
            if (!ObjectHelpers.deepEqual(prevDragItem, newDragItem)) {
                this.drag.setItem(newDragItem, null)
            }
        }
    }

    /** Устанавливает перетаскиваемый предмет и визуально, и в инвентаре. */
    setDragItem(slot: TableSlot, item: IInventoryItem | null): void {
        this.items[INVENTORY_DRAG_SLOT_INDEX] = item
        if(item) {
            this.drag.setItem(item, slot)
        } else {
            this.clearDragItem()
        }
    }

    /**
     * Очищает перетаскиваемый предмет и визуально, и в инвентаре.
     * @param move_to_inventory - попробовать переместить в инвентарь, если возможно (реально не используется, можно удалить)
     * @return прежнее значение этого предмета, если он не был перемещен в инвентарь
     */
    clearDragItem(move_to_inventory : boolean = false): IInventoryItem | null {
        let dragItem = this.items[INVENTORY_DRAG_SLOT_INDEX]
        if(dragItem && move_to_inventory) {
            this.moveFromSlots(false, [INVENTORY_DRAG_SLOT_INDEX])
            dragItem = this.items[INVENTORY_DRAG_SLOT_INDEX]
        }
        this.items[INVENTORY_DRAG_SLOT_INDEX] = null
        this.drag.clear()
        return dragItem
    }

    /**
     * Отправляет состояние на сервер.
     *
     * Не вызывать напрямую (кроме как из {@link BaseAnyInventoryWindow}).
     * Вместо него вызывать {@link BaseAnyInventoryWindow.sendInventory}, который может выполнять
     * дополнительные лействия (очищать крафт, добавлять список выброшенных и удаленных предметов).
     *
     * Пытается из несуществующих слотов в существующие, иначе выбасывает их.
     * Очищает временные и несуществующие слоты, если {@link TInventoryStateChangeParams.allow_temporary} != true
     */
    sendState(params: TInventoryStateChangeParams = {}): void {
        if (!params.allow_temporary) {
            const size = this.getSize()
            const thrown_items = params.thrown_items ??= []
            thrown_items.push(...this.moveFromSlots(true, size.invalidAndTemporaryIndices()))
            this.drag.clear() // потому что refresh() может его не очистить если окно уже закрыто
        }
        this.player.world.server.InventoryNewState({
            state: this.exportItems(),
            ...params
        })
        this.refresh() // например, нужно если sendState пеереместил предметы. sendState вызывается редко, refresh не помешает
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