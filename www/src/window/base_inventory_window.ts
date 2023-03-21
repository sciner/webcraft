import { INVENTORY_VISIBLE_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX } from "../constant.js";
import { InventoryComparator } from "../inventory_comparator.js";
import { BlankWindow } from "./blank.js";
import type {PlayerInventory} from "../player_inventory.js";
import type {Pointer} from "../../tools/gui/wm.js";
import type {World} from "../world.js";
import type {ServerClient} from "../server_client.js";

export class BaseInventoryWindow extends BlankWindow {
    [key: string]: any;

    world       : World
    server ?    : ServerClient
    inventory   : PlayerInventory
    drag        : Pointer

    constructor(x, y, w, h, id, title, text, inventory: PlayerInventory) {

        super(x, y, w, h, id, title, text)

        this.world      = inventory.player.world
        this.server     = this.world.server
        this.inventory  = inventory
        this.drag       = Qubatch.hud.wm.drag

    }

    // Updates drag UI if the dragged item changed
    onInventorySetState() {
        const inventory = this.inventory;
        const prevDragItem = this.drag.getItem();
        const newDargItem = inventory.items[INVENTORY_DRAG_SLOT_INDEX];
        if (newDargItem) {
            // update it, in case it changed
            const anySlot = this.inventory_slots[0]; // it's used only for getting size and drawing
            inventory.setDragItem(anySlot, newDargItem, this.drag, anySlot.width, anySlot.height);
        } else if (prevDragItem) {
            this.drag.clear();
        }
        this.fixAndValidateSlots('onInventorySetState')
    }

    // Return inventory slots
    getSlots() {
        return this.inventory_slots
    }

    /**
     * It's to find a possible bug where an item gets count=0.
     * It sets null to slots with count=0 and notifies the player.
     *
     * TODO remove its usage after the "count": 0 bug is fixed.
     *
     * @param {String} context - a string that helps identify where and why the error occurs.
     */
    fixAndValidateSlots(context) {
        // compare inventory slots and items
        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT; i++) {
            const item = this.inventory.items[i]
            const slotItem = this.inventory_slots[i].getItem()
            if (!InventoryComparator.itemsEqual(item, slotItem)) {
                window.alert(`Inventory slot differs from inventory: ${i}, ${item}, ${slotItem} ${context}`)
            }
        }
        const item = this.inventory.items[INVENTORY_DRAG_SLOT_INDEX]
        const slotItem = this.drag.getItem()
        if (!InventoryComparator.itemsEqual(item, slotItem)) {
            const str = `Drag slot differs from inventory: ${item}, ${slotItem} ${context}`
            console.error(str)
            window.alert(str)
        }
        // fix zero count
        const err = this.inventory.fixZeroCount()
        if (err) {
            const str = err + ' ' + context
            console.error(str)
            window.alert(str)
        }
    }

    // TODO move more shared code from BaseChestWindow and BaseCraftWindow here.
}