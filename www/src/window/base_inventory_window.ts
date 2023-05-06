import { INVENTORY_VISIBLE_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX, BAG_LENGTH_MAX, HOTBAR_LENGTH_MAX, UI_THEME } from "../constant.js";
import { InventoryComparator } from "../inventory_comparator.js";
import { BlankWindow } from "./blank.js";
import type {PlayerInventory} from "../player_inventory.js";
import type {Pointer, TMouseEvent} from "../vendors/wm/wm.js";
import type {World} from "../world.js";
import type {ServerClient} from "../server_client.js";
import type {GameClass} from "../game.js";
import {CraftTableInventorySlot, CraftTableSlot} from "./base_craft_window.js";

export class BaseInventoryWindow extends BlankWindow {
    [key: string]: any;

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
            this.world.server.InventoryNewState({
                state: this.inventory.exportItems(),
                thrown_items: [item],
                throw_yaw: playerYaw + mouseYaw
            })
            return true
        }
        return false
    }

    // TODO move more shared code from BaseChestWindow and BaseCraftWindow here.

    /** 
    * Автоматическая сортировка инвентаря
    * @param full - сортировать и основное поле
    */
    autoSortItems(full: boolean = false) {
        const items = this.inventory.items
        const bm = this.world.block_manager
        const bag_len = this.inventory.getBagLength()
        const hotbar_len = this.inventory.getHotbarLength()
        if (full) {
            for (let i = HOTBAR_LENGTH_MAX; i < bag_len; i++) {
                if (items[i]) {
                    const max_stack = bm.getItemMaxStack(items[i])
                    for (let j = i + 1; j < bag_len; j++) {
                        if (items[j] && items[i].id == items[j].id) {
                            const count = items[i].count + items[j].count
                            if (count <= max_stack) {
                                items[i].count += items[j].count
                                items[j] = null
                            } else {
                                items[i].count = max_stack
                                items[j].count = count - max_stack
                            }
                        }
                    }
                }
            }
            for (let i = HOTBAR_LENGTH_MAX; i < bag_len; i++) {
                if (!items[i]) {
                    for (let j = i + 1; j < bag_len; j++) {
                        if (items[j]) {
                            items[i] = {id: items[j].id, count: items[j].count}
                            items[j] = null
                            break
                        }
                    }
                }
            }
        }
        for (let i = bag_len; i < (BAG_LENGTH_MAX + HOTBAR_LENGTH_MAX); i++) {
            if (items[i]) {
                const max_stack = bm.getItemMaxStack(items[i])
                for (let j = HOTBAR_LENGTH_MAX; j < bag_len; j++) {
                    if (items[j] && items[i].id == items[j].id) {
                        const count = items[i].count + items[j].count
                        if (count <= max_stack) {
                            items[i].count += items[j].count
                            items[j] = null
                        } else {
                            items[i].count = max_stack
                            items[j].count = count - max_stack
                        }
                    }
                }
            }
        }
        for (let i = bag_len; i < (BAG_LENGTH_MAX + HOTBAR_LENGTH_MAX); i++) {
            if (items[i]) {
                for (let j = HOTBAR_LENGTH_MAX; j < bag_len; j++) {
                    if (!items[j]) {
                        items[j] = {id: items[i].id, count: items[i].count}
                        items[i] = null
                        break
                    }
                }
            }
        }
        for (let i = hotbar_len + 1; i < HOTBAR_LENGTH_MAX; i++) {
            if (items[i]) {
                const max_stack = bm.getItemMaxStack(items[i])
                for (let j = HOTBAR_LENGTH_MAX; j < (BAG_LENGTH_MAX + HOTBAR_LENGTH_MAX); j++) {
                    if (items[j] && items[i].id == items[j].id) {
                        const count = items[i].count + items[j].count
                        if (count <= max_stack) {
                            items[j].count += items[i].count
                            items[i] = null
                            break
                        } else {
                            items[j].count = max_stack
                            items[i].count = count - max_stack
                        }
                    }
                }
            }
        }
        for (let i = hotbar_len + 1; i < HOTBAR_LENGTH_MAX; i++) {
            if (items[i]) {
                for (let j = HOTBAR_LENGTH_MAX; j < (BAG_LENGTH_MAX + HOTBAR_LENGTH_MAX); j++) {
                    if (!items[j]) {
                        items[j] = {id: items[i].id, count: items[i].count}
                        items[i] = null
                        break
                    }
                }
            }
        }
        const thrown_items = []
        for (let i = bag_len; i < (BAG_LENGTH_MAX + HOTBAR_LENGTH_MAX); i++) {
            if (items[i]) {
                thrown_items.push(items[i])
                items[i] = null
            }
        }
        this.world.server.InventoryNewState({
            state: this.inventory.exportItems(),
            thrown_items: thrown_items
        })
        return true
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