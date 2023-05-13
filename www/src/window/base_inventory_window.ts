import {INVENTORY_DRAG_SLOT_INDEX, BAG_LENGTH_MAX, HOTBAR_LENGTH_MAX, UI_THEME, BAG_MAX_INDEX} from "../constant.js";
import { InventoryComparator } from "../inventory_comparator.js";
import { BlankWindow } from "./blank.js";
import type {PlayerInventory} from "../player_inventory.js";
import type {Pointer, TMouseEvent} from "../vendors/wm/wm.js";
import type {World} from "../world.js";
import type {ServerClient} from "../server_client.js";
import type {GameClass} from "../game.js";
import {CraftTableInventorySlot, CraftTableSlot} from "./base_craft_window.js";
import {Label} from "../ui/wm.js";
import {Resources} from "../resources.js";

export class BaseInventoryWindow extends BlankWindow {

    world       : World
    server ?    : ServerClient
    inventory   : PlayerInventory
    drag        : Pointer
    inventory_slots : CraftTableInventorySlot[]

    constructor(x, y, w, h, id, title, text, inventory: PlayerInventory) {

        super(x, y, w, h, id, title, text)

        this.world      = inventory.player.world
        this.server     = this.world.server
        this.inventory  = inventory
        this.drag       = Qubatch.hud.wm.drag

    }

    /** Создает кнопку сортировки с указанным обработчиком */
    protected createButtonSort(alignRight: boolean, dy: number, onMouseDown: () => void): Label {
        const size = 18 * this.zoom
        const x = alignRight
            ? this.w - size - UI_THEME.window_padding * this.zoom
            : UI_THEME.window_padding * this.zoom
        const y = (dy + UI_THEME.window_padding) * this.zoom
        const hud_atlas = Resources.atlas.get('hud')
        // кнопка сортировки
        const btnSort = new Label(x, y, size, size, 'btnSort')
        btnSort.setIcon(hud_atlas.getSpriteFromMap('sort'), 'centerstretch', .9)
        btnSort.z = 1
        btnSort.onMouseDown = onMouseDown
        this.add(btnSort)
        return btnSort
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

    /** @return craft or chest slots (i.e. any slots except inventory), if they exist */
    getCraftOrChestSlots(): CraftTableSlot[] {
        return []   // override in subclasses
    }

    refresh(): void {
        this.inventory.moveFromInvalidSlotsIfPossible()

        const size = this.inventory.getSize()
        for (let i = 0; i < this.inventory_slots.length; i++) {
            this.inventory_slots[i].locked = !size.slotExists(i)
        }
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
        for(let i = 0; i < BAG_MAX_INDEX; i++) {
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

    onDropOutside(e: TMouseEvent): boolean {
        const item = this.inventory.clearDragItem(false)
        if (item) {
            // determine the angle
            const FOV_MULTIPLIER = 0.85 // determined experimentally for better usability
            const game = Qubatch as GameClass
            const fov = game.render.camera.horizontalFovRad * FOV_MULTIPLIER
            const screenWidth = game.hud.wm.w
            const mouseYaw = (e.x - screenWidth * 0.5) / screenWidth * fov
            const playerYaw = this.inventory.player.rotate.z
            // tell the server to throw the item from the inventory
            this.inventory.sendStateChange({
                thrown_items: [item],
                throw_yaw: playerYaw + mouseYaw
            })
            return true
        }
        return false
    }

    // TODO move more shared code from BaseChestWindow and BaseCraftWindow here.

    /**
    * Создание слотов для инвентаря
    */
    createInventorySlots(sz, sx = UI_THEME.window_padding, sy = 166, belt_x? : float, belt_y? : float, draw_potential_slots : boolean = false) {

        if(this.inventory_slots) {
            console.error('createInventorySlots() already created')
            return
        }

        this.inventory_slots  = []
        const xcnt = 9
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
        for(let i = 0; i < HOTBAR_LENGTH_MAX; i++) {
            const x = belt_x + (i % HOTBAR_LENGTH_MAX) * (sz + margin)
            // const y = (sy + 120 * this.zoom) + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom + margin)
            const y = belt_y
            createSlot(x, y)
        }

        // верхние 3 ряда
        for(let i = 0; i < BAG_LENGTH_MAX; i++) {
            const x = sx + (i % xcnt) * (sz + margin)
            const y = sy + Math.floor(i / xcnt) * (sz + margin)
            createSlot(x, y)
        }

    }

}