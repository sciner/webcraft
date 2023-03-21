import {RecipeManager} from "./recipes.js";
import { Inventory } from "./inventory.js";
import { INVENTORY_DRAG_SLOT_INDEX } from "./constant.js";

// Player inventory
export class PlayerInventory extends Inventory {
    [key: string]: any;

    /**
     * @type { import("./ui/wm.js").WindowManager }
     */
    wm

    /**
     * 
     * @param {*} player 
     * @param {*} state 
     * @param { import("./hud.js").HUD } hud 
     */
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

    setState(inventory_state) {
        this.current = inventory_state.current;
        this.items = inventory_state.items;
        this.refresh();
        // update drag UI if the dragged item changed
        for(const w of this.hud.wm.visibleWindows()) {
            w.onInventorySetState && w.onInventorySetState();
        }
        this.update_number++
    }

    get inventory_window() {
        return this.hud.wm.getWindow('frmInventory');
    }

    // Open window
    open() {
        this.hud.wm.getWindow('frmInGameMain').openTab('frmCharacterWindow')
    }

    // Refresh
    refresh() {
        this.player.state.hands.right = this.current_item;
        if(this.hud) {
            this.hud.refresh();
            const frmRecipe = this.player.inventory?.recipes?.frmRecipe || null
            frmRecipe?.paginator.update();
        }
        return true;
    }

    /**
     * @param {*} slot 
     * @param {*} item 
     * @param { import("./ui/wm.js").Pointer } drag
     * @param {*} width 
     * @param {*} height 
     */
    setDragItem(slot, item, drag, width, height) {
        this.items[INVENTORY_DRAG_SLOT_INDEX] = item;
        if(!drag) {
            drag = this.hud.wm.drag;
        }
        if(item) {
            drag.setItem(item, slot)
        } else {
            this.clearDragItem()
        }
    }

    // The same result as in chest_manager.js: applyClientChange()
    clearDragItem(move_to_inventory : boolean = false) {
        const drag = this.hud.wm.drag
        if(move_to_inventory) {
            const dragItem = drag.getItem()
            if(dragItem) {
                this.increment(dragItem, true)
            }
        }
        this.items[INVENTORY_DRAG_SLOT_INDEX] = null
        drag.clear()
    }

}