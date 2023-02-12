import { Button, Label, TextEdit, Window } from "../../tools/gui/wm.js";
import { CraftTableInventorySlot } from "./base_craft_window.js";
import { BLOCK } from "../blocks.js";
import { Enchantments } from "../enchantments.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { BlankWindow } from "./blank.js";

class CreativeInventoryCollection extends Window {

    //
    constructor(x, y, w, h, id, title, text) {
        
        super(x, y, w, h, id, title, text)

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom
        this.max_height = 0
        this.style.background.color = '#00000000'
        this.style.border.hidden = true

        this.container = new Window(0, 0, w, h, id + '_container')
        // this.style.background.color = '#ff000055'
        this.add(this.container)

        // create clip mask
        this.clip()

    }

    _wheel(e) {
        this.scrollY += Math.sign(e.original_event.wheelDeltaY) * this.cell_size
        this.scrollY = Math.min(this.scrollY, 0)
        this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.h, 0) * -1)
        this.container.y = this.scrollY
    }

    // Init
    init(filter_text = null) {
        //
        const all_blocks = [];
        if(filter_text) {
            filter_text = filter_text
                .toUpperCase()
                .replaceAll('_', ' ')
                .replace(/\s\s+/g, ' ')
        }
        for(let b of BLOCK.getAll()) {
            if(b.id < 1 || !b.spawnable) {
                continue
            }
            const block = {
                id: b.id
            };
            if('power' in b && (b.power !== 0)) {
                block.power = b.power
            }
            if(!this.matchesFilter(b, filter_text)) {
                continue
            }
            all_blocks.push(block)
        }
        this.addEnchantedBooks(all_blocks, filter_text)
        // Create slots
        // let p = performance.now()
        this.initCollection(all_blocks)
        // console.log(performance.now() - p)
    }

    matchesFilter(block, filter_text) {
        return !filter_text || block.name.replaceAll('_', ' ').indexOf(filter_text) >= 0 || block.id == filter_text
    }

    addEnchantedBooks(all_blocks, filter_text) {
        const EB = BLOCK.ENCHANTED_BOOK;
        if(!EB || !this.matchesFilter(EB, filter_text)) {
            return;
        }
        for(const e of Enchantments.list) {
            if (e.in_creative_inventory) {
                for(let level = 1; level <= e.max_level; level++) {
                    const block = {
                        id: EB.id,
                        extra_data: {
                            enchantments: {}
                        }
                    };
                    block.extra_data.enchantments[e.id] = level;
                    all_blocks.push(block);
                }
            }
        }
    }

    // Init collection
    initCollection(all_blocks) {

        // remove all childrens
        for(let i = this.container.children.length - 1; i >= 0; i--) {
            const child = this.container.children[i]
            if(child instanceof CraftTableInventorySlot) {
                this.container.removeChild(child)
            }
        }

        this.scrollY            = 0
        this.max_height         = 0
        this.container.y        = 0

        let sx                  = 0
        let sy                  = 0
        let sz                  = this.cell_size
        let xcnt                = 9

        // Drop on pallette slots
        const dropFunc = function(e) {
            const that      = this
            const drag      = e.drag
            // prevent dropping into the same sloft after the mouse is released
            if(drag?.slot === this) {
                drag.slot = null
                return
            }
            const dropItem  = drag.getItem() // что перетащили
            let targetItem  = this.getItem() // куда перетащили
            if(targetItem && dropItem.id == targetItem.id) {
                targetItem = {...dropItem}
                // calc count
                let count = 1
                const max_in_stack = BLOCK.fromId(targetItem.id).max_in_stack;
                if(e.shiftKey) {
                    count = max_in_stack
                }
                targetItem.count = Math.min(targetItem.count + count, max_in_stack)
                this.getInventory().setDragItem(this, {...targetItem}, drag, that.w, that.height)
            } else {
                this.getInventory().clearDragItem()
            }
            return false;
        }

        const onMouseDownFunc = function(e) {
            const that = this
            let targetItem = this.getItem()
            // Set new drag
            if(!targetItem) {
                return
            }
            // calc count
            let count = 1
            if(e.shiftKey) {
                count = BLOCK.fromId(targetItem.id).max_in_stack
            }
            //
            targetItem = {...targetItem}
            targetItem.count = count
            this.getInventory().setDragItem(this, targetItem, e.drag, that.w, that.height)
            return false
        }

        const items = all_blocks
        for(let i = 0; i < items.length; i++) {
            const x = sx + (i % xcnt) * sz
            const y = sy + Math.floor(i / xcnt) * this.cell_size
            if(y + this.cell_size > this.max_height) {
                this.max_height = y + this.cell_size
            }
            const lblSlot = new CraftTableInventorySlot(x, y + 3 * this.zoom, sz, sz - 3 * this.zoom, 'lblCollectionSlot' + (i), null, null, this.parent, null)
            lblSlot.onDrop = dropFunc
            lblSlot.onMouseDown = onMouseDownFunc
            this.container.add(lblSlot)
            this.container.h = lblSlot.y + lblSlot.h
            lblSlot.setItem(all_blocks[i])
        }

        // Empty slots
        const remains = items.length < 81 ? 81 - items.length : 9 - (items.length % 9);
        for(let j = 0; j < remains; j++) {
            let i = j + items.length
            let x = sx + (i % xcnt) * sz
            let y = sy + Math.floor(i / xcnt) * this.cell_size
            if(y + this.cell_size > this.max_height) {
                this.max_height = y + this.cell_size
            }
            const lblSlot = new CraftTableInventorySlot(x, y, sz, sz, 'lblCollectionSlot' + (i), null, '' + i, this.parent, null)
            lblSlot.onDrop = dropFunc
            this.container.add(lblSlot)
            this.container.h = lblSlot.y + lblSlot.h
            lblSlot.setItem(all_blocks[i])
        }

    }

}

// CreativeInventoryWindow...
export class CreativeInventoryWindow extends BlankWindow {

    constructor(inventory) {

        super(10 * UI_ZOOM, 10 * UI_ZOOM, 390 * UI_ZOOM, 450 * UI_ZOOM, 'frmCreativeInventory')

        this.inventory = inventory

        this.setBackground('./media/gui/creative_inventory/tab_items.png')

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom

        // Window title
        let lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 230 * this.zoom, 30 * this.zoom, 'lbl1', null, Lang.creative_inventory)
        this.add(lbl1)

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size)

        // Создание слотов для блоков коллекций
        this.createCollectionSlots(this.cell_size)

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const that = this
            // Close button
            const btnClose = new Button(that.w - this.cell_size, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial'
            btnClose.style.background.image = image
            btnClose.style.background.image_size_mode = 'stretch'
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                that.hide()
            }
            that.add(btnClose)
        });

        // Search input
        this.createSearchInput()

    }

    // Search input
    createSearchInput() {

        // Text editor
        const txtSearch = new TextEdit(
            16 * this.zoom,
            37 * this.zoom,
            this.cell_size * 9,
            25 * this.zoom,
            'txtSearch1',
            null,
            'Type for search'
        )

        txtSearch.word_wrap              = false
        txtSearch.focused                = true
        txtSearch.max_length             = 100
        txtSearch.max_lines              = 1
        txtSearch.max_chars_per_line     = 20

        // style
        txtSearch.style.border.hidden    = false
        txtSearch.style.border.style     = 'inset'
        txtSearch.style.font.color       = '#ffffff'
        txtSearch.style.background.color = '#706f6c'

        this.add(txtSearch)

        txtSearch.onChange = (text) => {
            this.collection.init(text)
        }

    }

    // Обработчик открытия формы
    onShow() {
        this.getRoot().center(this);
        Qubatch.releaseMousePointer()
        if(this.inventory_slots) {
            for(let slot of this.inventory_slots) {
                if(slot) {
                    slot.refresh()
                }
            }
        }
        super.onShow()
    }

    // Обработчик закрытия формы
    onHide() {
        this.inventory.clearDragItem();
        // Save inventory
        Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), [], null, true);
    }

    /**
    * Создание слотов для инвентаря
    * @param int sz Ширина / высота слота
    */
    createInventorySlots(sz) {
        if(this.inventory_slots) {
            console.error('createInventorySlots() already created')
            return
        }
        this.inventory_slots = []
        // нижний ряд (видимые на хотбаре)
        let sx          = 16 * this.zoom
        let sy          = this.h - this.cell_size - 14 * this.zoom
        let xcnt        = 9
        for(let i = 0; i < 9; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * this.cell_size, sz, sz, 'lblSlot' + (i), null, '' + i, this, i)
            this.add(lblSlot)
            this.inventory_slots.push(lblSlot)
        }
    }

    //
    createCollectionSlots() {
        if(this.collection) {
            console.error('error_create_collection_slots_already_created')
            return
        }
        this.collection = new CreativeInventoryCollection(16 * this.zoom, 68 * this.zoom, this.cell_size * 9, this.cell_size * 9, 'wCollectionSlots')
        this.add(this.collection)
        this.collection.init()
        return this.collection
    }

    // Return inventory slots
    getSlots() {
        return this.inventory_slots;
    }

    fixAndValidateSlots(context) {
        // Do nothing. It's called by slots and used to vlidate in other windows.
    }
}