import {INVENTORY_DRAG_SLOT_INDEX, BAG_LENGTH_MAX, HOTBAR_LENGTH_MAX, UI_THEME, BAG_END, MOUSE} from "../constant.js";
import { InventoryComparator } from "../inventory_comparator.js";
import { BlankWindow } from "./blank.js";
import type {PlayerInventory} from "../player_inventory.js";
import type {Pointer, TMouseEvent} from "../vendors/wm/wm.js";
import type {World} from "../world.js";
import type {ServerClient} from "../server_client.js";
import {TableDataSlot, TableSlot} from "./base_craft_window.js";
import {Button, Label, Window} from "../ui/wm.js";
import {Resources} from "../resources.js";
import type {TInventoryStateChangeParams} from "../inventory.js";
import {ArrayHelpers} from "../helpers/array_helpers.js";
import type {GameClass} from "../game.js";
import {SpriteAtlas} from "../core/sprite_atlas.js";
import {Lang} from "../lang.js";

/** Общий базовый класс {@link BaseInventoryWindow} и {@link CreativeInventoryWindow} */
export abstract class BaseAnyInventoryWindow extends BlankWindow {

    world           : World
    inventory       : PlayerInventory
    inventory_slots : TableDataSlot[] = [] // Все слоты инвентаря в данном окне
    bag_slots       : TableDataSlot[] = [] // Подмножество слотов хотбара и рюкзака

    cell_size       : number
    slot_margin     : number
    slots_x         : number
    slots_y         : number

    add(w : Window): void {
        super.add(w)
        if (w instanceof TableDataSlot && w.isInventorySlot()) {
            if (this.inventory_slots.find(it => it.slot_index === w.slot_index)) {
                throw `inventory slot already created ${w.slot_index}`
            }
            this.inventory_slots.push(w)
            if (w.slot_index < BAG_END) {
                this.bag_slots.push(w)
            }
        }
    }

    /** Убирает из drag слота и возвращает предмет, выброшенный за пределы окна. */
    protected getItemDroppedOutside(e: TMouseEvent): IInventoryItem | null {
        const inventory = this.inventory
        if (e.button_id == MOUSE.BUTTON_LEFT) { // выбрасываем весь стек
            return inventory.clearDragItem()
        }
        if (e.button_id == MOUSE.BUTTON_RIGHT) { // выбрасываем 1 предмет
            const item = inventory.items[INVENTORY_DRAG_SLOT_INDEX]
            if (!item) {
                return null
            }
            if (item.count === 1) {
                return inventory.clearDragItem()
            }
            item.count--
            inventory.drag.refresh()
            return {...item, count: 1}
        }
        return null
    }

    /**
     * Вызывается менеджером окон если что-то выбросили за пределами всех видимых окон.
     * @return true если данное окно понимает может обработать это событие, и не нужно перебирать остальные окна
     */
    abstract onDropOutside(e: TMouseEvent): boolean

    /** @return craft or chest slots (i.e. any slots except inventory), if they exist */
    getCraftOrChestSlots(): TableSlot[] {
        return ArrayHelpers.EMPTY   // override in subclasses
    }

    /**
     * Отправляет инвентарь на сервер, а перед отправкой может произвести дополнительные действия,
     * специфичные для данного окна.
     */
    sendInventory(params: TInventoryStateChangeParams): void {
        this.inventory.sendState(params)
    }

    /**
     * Отладочноая функция, чтобы найти редко возникающие баги в инвентаре и сообщить о месте возникновения.
     * В частности, баг с колическтвом = 0.
     * @param context - строка, поясняющая место ошибки.
     *
     * TODO когда-нибудь в будущем удалить когда точно уверенны что багов не осталось и уже не добавятся
     */
    abstract fixAndValidateSlots(context: string): void

    onShow(args) {
        const inventory = this.inventory
        inventory.moveFromSlots(false, inventory.getSize().invalidAndTemporaryIndices())
        this.world.game.releaseMousePointer()
        this.onInventoryChange('onShow')
        super.onShow(args)
    }

    /** Обработчик закрытия формы */
    onHide() {
        this.sendInventory({})
    }

    /**
     * Вызывается 1 раз после открытия окна, или после изменения, (потенциально) меняющего 1 или несколько слотов.
     *
     * Простое правило - где вызывать:
     * - при открытии формы
     * - при получении данных извне
     * - в конце обработчиков событий интерфейса (кликов мыши)
     * Простое правило - где НЕ вызывать:
     * - из обработчиков изменения слотов
     * - из методов логики, которые меняют слоты
     *
     * @param context - необязательная строка, сообщаяя откуда (почему) вызыван метод
     *
     * Может выполнять длительные операции, которые нежелательно вызывать при изменении каждого слота в отдельности.
     * TODO перенести сюда как можно больше: рецепты, пререрисовку, слотов,, и т.п.
     */
    onInventoryChange(context?: string): void {
        this.fixAndValidateSlots(context ?? 'unknown')
        this.inventory.refresh()
    }
}

/** Общий базовый класс {@link BaseCraftWindow} и {@link BaseChestWindow} */
export abstract class BaseInventoryWindow extends BaseAnyInventoryWindow {

    server ?    : ServerClient
    drag        : Pointer
    protected delete_items: IInventoryItem[] = [] // предметы, выброшенные в корзину

    constructor(x, y, w, h, id, title, text, inventory: PlayerInventory) {

        super(x, y, w, h, id, title, text)

        this.world      = inventory.player.world
        this.server     = this.world.server
        this.inventory  = inventory
        this.drag       = Qubatch.hud.wm.drag

    }

    /** Создает кнопку сортировки с указанным обработчиком */
    protected createButtonSort(alignRight: boolean, dy: number, onMouseDown: () => void): Button {
        const size = 18 * this.zoom
        const x = alignRight
            ? this.w - size - UI_THEME.window_padding * this.zoom
            : UI_THEME.window_padding * this.zoom
        const y = (dy + UI_THEME.window_padding) * this.zoom
        const hud_atlas = Resources.atlas.get('hud')
        // кнопка сортировки
        const btnSort = new Button(x, y, size, size, 'btnSort')
        btnSort.setIcon(hud_atlas.getSpriteFromMap('sort'), 'centerstretch', .9)
        btnSort.z = 1
        btnSort.onMouseDown = onMouseDown
        this.add(btnSort)
        return btnSort
    }

    /** См. {@link BaseAnyInventoryWindow.fixAndValidateSlots} */
    fixAndValidateSlots(context: string): void {
        // compare inventory slots and items
        for(const slot of this.inventory_slots) {
            const item = this.inventory.items[slot.slot_index]
            const slotItem = slot.item
            if (!InventoryComparator.itemsEqual(item, slotItem)) {
                window.alert(`Inventory slot differs from inventory: ${slot.slot_index}, ${item}, ${slotItem} ${context}`)
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

    /**
     * Создание слотов для инвентаря
     */
    createInventorySlots(sz, sx = UI_THEME.window_padding, sy = 166, belt_x? : float, belt_y? : float, draw_potential_slots : boolean = false) {
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
            const lblSlot = new TableDataSlot(x, y, sz, sz,
                `lblSlot${index}`, null, null, this,
                index)
            this.add(lblSlot);
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

    /** Создать слот удаления предметов из инвенторя */
    protected createDeleteSlot(sz: float): void {
        const deleteItem = () => {
            const item = this.inventory.clearDragItem()
            this.delete_items.push(item)
        }
        const padding = UI_THEME.window_padding * this.zoom
        const width = 336
        const height = 190
        const form_atlas = new SpriteAtlas()
        const confirm = new Window((this.w - width * this.zoom) / 2, (this.h - height * this.zoom) / 2 - sz, width * this.zoom, height * this.zoom, 'confirm_delete')
        form_atlas.fromFile('./media/gui/popup.png').then(async (atlas : SpriteAtlas) => {
            confirm.setBackground(await atlas.getSprite(0, 0, width * 3, height * 3), 'none', this.zoom / 2.0)
        })
        confirm.z = 1
        confirm.hide()
        this.add(confirm)

        const title = new Label(38 * this.zoom, 25 * this.zoom, 0, 0, `lblConfirmTitle`, '', Lang.delete_item + '?')
        title.style.font.size = UI_THEME.popup.title.font.size
        title.style.font.color = UI_THEME.popup.title.font.color
        confirm.add(title)

        const text = new Label(38 * this.zoom, 60 * this.zoom, 0, 0, `lblConfirmText`, '', Lang.lost_item)
        text.style.font.size = UI_THEME.popup.text.font.size
        text.style.font.color = UI_THEME.popup.text.font.color
        confirm.add(text)

        const hud_atlas = Resources.atlas.get('hud')
        const btnSwitch = new Label(38 * this.zoom, 140 * this.zoom, 16 * this.zoom, 16 * this.zoom, 'btnSwitch', ' ', '        ' + Lang.do_not_show)
        btnSwitch.style.font.size = UI_THEME.popup.text.font.size
        btnSwitch.style.font.color = '#507ea4'
        btnSwitch.setBackground(hud_atlas.getSpriteFromMap('check_bg'))
        btnSwitch.onDrop = btnSwitch.onMouseDown = function() {
            btnSwitch.toggled = !btnSwitch.toggled
            if (btnSwitch.toggled) {
                btnSwitch.setIcon(hud_atlas.getSpriteFromMap('check'))
            } else {
                btnSwitch.setIcon(null)
            }
        }
        confirm.add(btnSwitch)

        const btnYes = new Button(50 * this.zoom, 90 * this.zoom, 90 * this.zoom, 30 * this.zoom, 'btnOK', Lang.yes)
        btnYes.onDrop = btnYes.onMouseDown = function() {
            confirm.hide()
            deleteItem()
            if (btnSwitch?.toggled) {
                Qubatch.settings.check_delete_item = false
                Qubatch.settings.save()
            }
        }
        confirm.add(btnYes)
        const btnNo = new Button(185 * this.zoom, 90 * this.zoom, 90 * this.zoom, 30 * this.zoom, 'btnNo', Lang.no)
        btnNo.onDrop = btnNo.onMouseDown = function() {
            //ct.inventory.clearDragItem(true)
            confirm.hide()
        }
        confirm.add(btnNo)

        const delete_slot = new Label(this.w - 2 * sz, this.h - sz - padding, sz, sz, `lblDeleteSlot`)
        delete_slot.setBackground(hud_atlas.getSpriteFromMap('window_slot'))
        delete_slot.setIcon(hud_atlas.getSpriteFromMap('trashbin'))
        delete_slot.onDrop = function() {
            if (Qubatch.settings.check_delete_item) {
                confirm.show()
            } else {
                deleteItem()
            }
        }
        this.add(delete_slot)
    }

    onDropOutside(e: TMouseEvent): boolean {
        const item = this.getItemDroppedOutside(e)
        if (!item) {
            return false
        }
        // determine the angle
        const FOV_MULTIPLIER = 0.85 // determined experimentally for better usability
        const game = this.world.game
        const fov = game.render.camera.horizontalFovRad * FOV_MULTIPLIER
        const screenWidth = game.hud.wm.w
        const mouseYaw = (e.x - screenWidth * 0.5) / screenWidth * fov
        const playerYaw = this.inventory.player.rotate.z
        // tell the server to throw the item from the inventory
        this.sendInventory({
            thrown_items: [item],
            throw_yaw: playerYaw + mouseYaw,
            allow_temporary: true
        })
        this.onInventoryChange('onDropOutside')
        return true
    }

    sendInventory(params: TInventoryStateChangeParams): void {
        if (this.delete_items.length) {
            params.delete_items ??= []
            params.delete_items.push(...this.delete_items)
            this.delete_items.length = 0
        }
        super.sendInventory(params)
    }

}