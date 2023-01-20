import {RecipeManager} from "./recipes.js";
import { Inventory } from "./inventory.js";
import { INVENTORY_DRAG_SLOT_INDEX } from "./constant.js";

// Player inventory
export class PlayerInventory extends Inventory {

    constructor(player, state, hud) {
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
            this.hud.refresh();
        };
        // Add this for draw on screen
        Qubatch.hotbar.setInventory(this)
    }

    setState(inventory_state) {
        this.current = inventory_state.current;
        this.items = inventory_state.items;
        this.refresh();
        // update drag UI if the dragged item changed
        for(const w of this.hud.wm.visibleWindows()) {
            w.onInventorySetState && w.onInventorySetState();
        }
    }

    get inventory_window() {
        return this.hud.wm.getWindow('frmInventory');
    }

    // Open window
    open() {
        if(this.player.game_mode.isCreative()) {
            this.hud.wm.getWindow('frmCreativeInventory').toggleVisibility();
        } else {
            this.hud.wm.getWindow('frmInventory').toggleVisibility();
        }
    }

    // Refresh
    refresh() {
        this.player.state.hands.right = this.current_item;
        if(this.hud) {
            this.hud.refresh();
            try {
                const frmRecipe = this.hud.wm.getWindow('frmRecipe');
                frmRecipe.paginator.update();
            } catch(e) {
                // do nothing
            }
        }
        return true;
    }

    //
    setDragItem(slot, item, drag, width, height) {
        this.items[INVENTORY_DRAG_SLOT_INDEX] = item;
        if(!drag) {
            drag = this.hud.wm.drag;
        }
        if(item) {
            drag.setItem({
                item,
                draw: function(e) {
                    slot.drawItem(e.ctx, this.item, e.x, e.y, width, height);
                }
            });
        } else {
            this.clearDragItem();
        }
    }

    // The same result as in chest_manager.js: applyClientChange()
    clearDragItem(move_to_inventory) {
        const drag = this.hud.wm.drag;
        if(move_to_inventory) {
            const dragItem = drag.getItem();
            if(dragItem) {
                this.increment(dragItem.item, true);
            }
        }
        this.items[INVENTORY_DRAG_SLOT_INDEX] = null;
        drag.clear();
    }

}