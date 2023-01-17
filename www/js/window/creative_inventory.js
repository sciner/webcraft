import {Button, Label, TextEdit, Window} from "../../tools/gui/wm.js";
import {CraftTableInventorySlot} from "./base_craft_window.js";
import { BLOCK } from "../blocks.js";
import { Enchantments } from "../enchantments.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";

class CreativeInventoryCollection extends Window {

    //
    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;
        this.max_height = 0;
        //
        this.style.background.color = '#00000000';
        this.style.border.hidden = true;
        //
        this._wheel = function(e) {
            this.scrollY += Math.sign(e.original_event.wheelDeltaY) * this.cell_size;
            this.scrollY = Math.min(this.scrollY, 0);
            this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.height, 0) * -1);
        };
    }

    // Init
    init(filter_text = null) {
        //
        const all_blocks = [];
        if(filter_text) {
            filter_text = filter_text
                .toUpperCase()
                .replaceAll('_', ' ')
                .replace(/\s\s+/g, ' ');
        }
        for(let b of BLOCK.getAll()) {
            if(b.id < 1 || !b.spawnable) {
                continue;
            }
            const block = {
                id: b.id
            };
            if('power' in b && (b.power !== 0)) {
                block.power = b.power;
            }
            if(!this.matchesFilter(b, filter_text)) {
                continue;
            }
            all_blocks.push(block)
        }
        this.addEnchantedBooks(all_blocks, filter_text);
        // Create slots
        this.initCollection(all_blocks);
    }

    matchesFilter(block, filter_text) {
        return !filter_text || block.name.replaceAll('_', ' ').indexOf(filter_text) >= 0 || block.id == filter_text;
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
        this.list.clear();
        this.scrollY            = 0;
        this.max_height         = 0;
        this.collection_slots   = [];
        let sx                  = 0;
        let sy                  = 0;
        let sz                  = this.cell_size;
        let xcnt                = 9;
        const ct                = this;

        // TODO: pixi
        return

        // Drop on pallette slots
        const dropFunc = function(e) {
            const that      = this;
            const drag      = e.drag;
            const dropItem  = drag.getItem().item; // что перетащили
            let targetItem  = this.getInventoryItem(); // куда перетащили
            if(targetItem && dropItem.id == targetItem.id) {
                targetItem = {...dropItem};
                // calc count
                let count = 1;
                const max_in_stack = BLOCK.fromId(targetItem.id).max_in_stack;
                if(e.shiftKey) {
                    count = max_in_stack
                }
                targetItem.count = Math.min(targetItem.count + count, max_in_stack);
                this.getInventory().setDragItem(this, {...targetItem}, drag, that.width, that.height);
            } else {
                this.getInventory().clearDragItem();
            }
            return false;
        };
        const onMouseDownFunc = function(e) {
            let that = this;
            let targetItem = this.getInventoryItem();
            // Set new drag
            if(!targetItem) {
                return;
            }
            // calc count
            let count = 1;
            if(e.shiftKey) {
                count = BLOCK.fromId(targetItem.id).max_in_stack;
            }
            //
            targetItem = {...targetItem};
            targetItem.count = count;
            this.getInventory().setDragItem(this, targetItem, e.drag, that.width, that.height);
            return false;
        };

        const items = all_blocks;
        for(let i = 0; i < items.length; i++) {
            let x = sx + (i % xcnt) * sz;
            let y = sy + Math.floor(i / xcnt) * this.cell_size;
            if(y + this.cell_size > this.max_height) {
                this.max_height = y + this.cell_size;
            }
            const lblSlot = new CraftTableInventorySlot(x, y, sz, sz, 'lblCollectionSlot' + (i), null, '' + i, this.parent, null);
            //
            lblSlot.onMouseDown = onMouseDownFunc;
            lblSlot.onDrop = dropFunc;
            // Draw
            lblSlot.drawOrig = lblSlot.draw;
            lblSlot.draw = function(ctx, ax, ay) {};
            //
            ct.add(lblSlot);
            ct.collection_slots.push(lblSlot);
            lblSlot.setItem(all_blocks[i]);
        }

        // Empty slots
        const remains = items.length < 81 ? 81 - items.length : 9 - (items.length % 9);
        for(let j = 0; j < remains; j++) {
            let i = j + items.length;
            let x = sx + (i % xcnt) * sz;
            let y = sy + Math.floor(i / xcnt) * this.cell_size;
            if(y + this.cell_size > this.max_height) {
                this.max_height = y + this.cell_size;
            }
            const lblSlot = new CraftTableInventorySlot(x, y, sz, sz, 'lblCollectionSlot' + (i), null, '' + i, this.parent, null);
            //
            lblSlot.onDrop = dropFunc;
            // Draw
            lblSlot.drawOrig = lblSlot.draw;
            lblSlot.draw = function(ctx, ax, ay) {};
            //
            ct.add(lblSlot);
            ct.collection_slots.push(lblSlot);
            lblSlot.setItem(all_blocks[i]);
        }

    }

    // Draw
    draw(ctx, ax, ay) {
        super.draw(ctx, ax, ay);
        let x = this.x + this.ax;
        let y = this.y + this.ay;
        let w = this.cell_size * 9;
        let h = this.cell_size * 9;
        let region = new Path2D();
        region.rect(x, y, w, h);
        ctx.save();
        ctx.clip(region, 'evenodd');
        for(let lblSlot of this.list.values()) {
            lblSlot.drawOrig(ctx, ax + 16 * this.zoom, ay + 70 * this.zoom + this.scrollY);
        }
        ctx.restore();
    }

}

// CreativeInventoryWindow...
export class CreativeInventoryWindow extends Window {

    constructor(inventory) {

        super(10, 10, 390, 450, 'frmCreativeInventory', null, null);

        this.w *= this.zoom;
        this.h *= this.zoom;

        this.inventory = inventory;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.background.image_size_mode = 'stretch';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/creative_inventory/tab_items.png');
        ct.hide();

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Add labels to window
        let lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 230 * this.zoom, 30 * this.zoom, 'lbl1', null, Lang.creative_inventory);
        ct.add(lbl1);

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);

        // Создание слотов для блоков коллекций
        this.createCollectionSlots(this.cell_size);

        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Qubatch.releaseMousePointer();
        }
        
        // Обработчик закрытия формы
        this.onHide = function() {
            this.inventory.clearDragItem();
            // Save inventory
            Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), [], null, true);
        }

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            let btnClose = new Button(ct.width - this.cell_size, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image = image;
            btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                ct.hide();
            }
            ct.add(btnClose);
        });

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.ESC: {
                    if(!down) {
                        ct.hide();
                        try {
                            Qubatch.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    return true;
                }
            }
            return false;
        }

        // Text editor
        const txtSearch = new TextEdit(
            16 * this.zoom,
            37 * this.zoom,
            this.cell_size * 9,
            25 * this.zoom,
            'txtSearch1',
            null,
            'Type for search'
        );
        txtSearch.word_wrap              = false;
        txtSearch.focused                = true;
        txtSearch.max_length             = 100;
        txtSearch.max_lines              = 1;
        txtSearch.max_chars_per_line     = 20;
        // style
        txtSearch.style.color            = '#fff';
        txtSearch.style.border.hidden    = false;
        txtSearch.style.border.style     = 'inset';
        txtSearch.style.font.size        *= this.zoom;
        txtSearch.style.background.color = '#706f6cff';
        ct.add(txtSearch);

        txtSearch.onChange = (text) => {
            this.collection.init(text);
        };

    }

    /**
    * Создание слотов для инвентаря
    * @param int sz Ширина / высота слота
    */
    createInventorySlots(sz) {
        const ct = this;
        if(ct.inventory_slots) {
            console.error('createInventorySlots() already created');
            return;
        }
        ct.inventory_slots  = [];
        // нижний ряд (видимые на хотбаре)
        let sx          = 16 * this.zoom;
        let sy          = this.height - this.cell_size - 14 * this.zoom;
        let xcnt        = 9;
        for(let i = 0; i < 9; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * this.cell_size, sz, sz, 'lblSlot' + (i), null, '' + i, this, i);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
    }

    //
    createCollectionSlots() {
        //
        if(this.collection) {
            console.error('createCollectionSlots() already created');
            return;
        }
        this.collection = new CreativeInventoryCollection(16 * this.zoom, 68 * this.zoom, this.cell_size * 9, this.cell_size * 9, 'wCollectionSlots');
        this.add(this.collection);
        this.collection.init();
        return this.collection;
    }

    // Return inventory slots
    getSlots() {
        return this.inventory_slots;
    }

}