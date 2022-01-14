import {Button, Label, Window} from "../../tools/gui/wm.js";
import {CraftTableInventorySlot} from "./base_craft_window.js";
import { BLOCK } from "../blocks.js";

class CreativeInventoryCollection extends Window {

    //
    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        // Ширина / высота слота
        this.cell_size = 36 * this.zoom;
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
    init() {
        //
        let all_blocks = Array.from(BLOCK.getAll().values()).filter((i) => {
            return (i.id > 0) && i.spawnable;
        });
        //
        all_blocks.sort((a, b) => {
            //
            if(a.inventory_icon_id == 0) {
                return 1;
            } else if(b.inventory_icon_id == 0) {
                return -1;
            }
            //
            if(!a.style) a.style = 'default';
            if(!b.style) b.style = 'default';
            if(a.style != b.style) {
                return a.style > b.style ? 1 : -1;
            }
            if(a.tags && b.tags) {
                return a.tags[0] > b.tags[0] ? 1 : -1;
            }
            if(a.tags && !b.tags) {
                return -1;
            } if(b.tags && !a.tags) {
                return 1;
            }
            return b.id - a.id;
        });
        // Create slots
        this.initCollection(all_blocks);
    }

    // Init collection
    initCollection(all_blocks) {
        this.collection_slots   = [];
        let sx                  = 0;
        let sy                  = 0;
        let sz                  = this.cell_size;
        let xcnt                = 9;
        const ct                = this;
        //
        let items = all_blocks;
        for(let i = 0; i < items.length; i++) {
            let x = sx + (i % xcnt) * sz;
            let y = sy + Math.floor(i / xcnt) * this.cell_size;
            if(y + this.cell_size > this.max_height) {
                this.max_height = y + this.cell_size;
            }
            const lblSlot = new CraftTableInventorySlot(x, y, sz, sz, 'lblCollectionSlot' + (i), null, '' + i, this.parent, null);
            //
            lblSlot.onMouseDown = function(e) {
                let that = this;
                let targetItem = this.getInventoryItem();
                // Set new drag
                if(!targetItem) {
                    return;
                }
                // calc count
                let count = 1;
                if(e.shiftKey) {
                    count = targetItem.max_in_stack;
                }
                //
                targetItem = {...targetItem};
                targetItem.count = count;
                e.drag.setItem({
                    draw: function(e) {
                        that.drawItem(e.ctx, this.item, e.x, e.y, that.width, that.height);
                    },
                    item: targetItem
                });
                return false;
            };
            // Drag & drop
            lblSlot.onDrop = function(e) {
                let that        = this;
                let drag        = e.drag;
                let dropItem    = drag.getItem().item; // что перетащили
                let targetItem  = this.getInventoryItem(); // куда перетащили
                if(dropItem.id == targetItem.id) {
                    targetItem = {...dropItem};
                    // calc count
                    let count = 1;
                    if(e.shiftKey) {
                        count = targetItem.max_in_stack;
                    }
                    targetItem.count = Math.min(targetItem.count + count, targetItem.max_in_stack);
                    //
                    drag.setItem({
                        draw: function(e) {
                            that.drawItem(e.ctx, this.item, e.x, e.y, that.width, that.height);
                        },
                        item: {...targetItem}
                    });
                } else {
                    drag.setItem(null);
                }
                return false;
            };
            // Draw
            lblSlot.drawOrig = lblSlot.draw;
            lblSlot.draw = function(ctx, ax, ay) {};
            //
            ct.add(lblSlot);
            ct.collection_slots.push(lblSlot);
            let item = all_blocks[i];
            lblSlot.setItem(item);
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
            lblSlot.drawOrig(ctx, ax + 16 * this.zoom, ay + 34 * this.zoom + this.scrollY);
        }
        ctx.restore();
    }

}

export class CreativeInventoryWindow extends Window {

    constructor(x, y, w, h, id, title, text, inventory) {

        super(x, y, w, h, id, title, text);
        this.width *= this.zoom;
        this.height *= this.zoom;

        this.inventory = inventory;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.background.image_size_mode = 'stretch';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/creative_inventory/tab_items.png');
        ct.hide();

        this.dragItem = null;

        // Ширина / высота слота
        this.cell_size = 36 * this.zoom;

        // Add labels to window
        let lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 230 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Creative inventory');
        ct.add(lbl1);

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);

        // Создание слотов для блоков коллекций
        this.createCollectionSlots(this.cell_size);

        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Game.releaseMousePointer();
        }
        
        // Обработчик закрытия формы
        this.onHide = function() {
            this.getRoot().drag.clear();
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
        this.collection = new CreativeInventoryCollection(16 * this.zoom, 35 * this.zoom, this.cell_size * 9, this.cell_size * 9, 'wCollectionSlots');
        this.add(this.collection);
        this.collection.init();
    }

    // Return inventory slots
    getSlots() {
        return this.inventory_slots;
    }

}