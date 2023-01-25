import { INVENTORY_DRAG_SLOT_INDEX } from "../constant.js";
import { BlankWindow } from "./blank.js";

export class BaseInventoryWindow extends BlankWindow {

    constructor(x, y, w, h, id, title, text, inventory) {

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
    }

    // Return inventory slots
    getSlots() {
        return this.inventory_slots;
    }

    // TODO move more shared code from BaseChestWindow and BaseCraftWindow here.
}