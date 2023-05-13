import {RecipeManager} from "./recipes.js";
import {Inventory, TInventoryState} from "./inventory.js";
import {INVENTORY_DRAG_SLOT_INDEX, INVENTORY_HOTBAR_SLOT_COUNT, INVENTORY_VISIBLE_SLOT_COUNT} from "./constant.js";
import type {WindowManager, Pointer} from "./vendors/wm/wm.js";
import type {Player} from "./player.js";
import type {HUD} from "./hud.js";
import type {InventoryWindow} from "./window/index.js";
import type {CraftTableSlot} from "./window/base_craft_window.js";
import {InventoryComparator} from "./inventory_comparator.js";

/**
 * A client version of {@link Inventory}.
 * Maybe rename it into ClientInventory for clarity.
 */
export class PlayerInventory extends Inventory {

    wm: WindowManager
    hud: HUD
    recipes: RecipeManager

    constructor(player: Player, state: TInventoryState, hud: HUD) {
        super(player, {current: {index: 0, index2: -1}, items: []});
        this.hud = hud
        for(let i = 0; i < this.max_count; i++) {
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
        this.hud.wm.getWindow('frmInGameMain').openTab('frmInventory')
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
        const bm = this.block_manager
        const items = this.items
        const simpleKeys = new Array<string>(INVENTORY_VISIBLE_SLOT_COUNT)
        const freeSpaceByKey: Dict<int> = {} // total free space in all stacks of this type of item

        // for each slot that can be added to
        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT; i++) {
            const item = items[i]
            if (item) {
                const key = InventoryComparator.makeItemCompareKey(item)
                simpleKeys[i] = key
                const thisItemFreeSpace = bm.getItemMaxStack(item) - item.count
                freeSpaceByKey[key] = (freeSpaceByKey[key] ?? 0) + thisItemFreeSpace
            }
        }

        // for each slot that can be freed. It excludes HUD slots
        for(let i = INVENTORY_HOTBAR_SLOT_COUNT; i < INVENTORY_VISIBLE_SLOT_COUNT; i++) {
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
    incrementAndReorganize(mat: IInventoryItem, no_update_if_remains?: boolean): boolean {
        let result = this.increment(mat, no_update_if_remains, true)
        if (mat.count) {
            const slotIndex = this.reorganizeFreeSlot()
            if (slotIndex >= 0) {
                this.items[slotIndex] = {...mat}
                mat.count = 0
                this.refresh()
                result = true
            }
        }
        return result
    }
}