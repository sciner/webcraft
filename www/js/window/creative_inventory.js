import {Window, Label, Button} from "../../tools/gui/wm.js";
import {CraftTableRecipeSlot, CraftTableInventorySlot, CraftTableResultSlot} from "./craft_table.js";
import RECIPES from "../recipes.js";
import {BLOCK} from "../blocks.js";

class CreativeInventoryCollection extends Window {

    //
    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        // Ширина / высота слота
        this.cell_size = 36;
        this.max_height = 0;
        //
        this.style.background.color = '#00000000';
        this.style.border.hidden = true;
        //
        this._wheel = function(e) {
            this.scrollY += Math.sign(e.original_event.wheelDeltaY) * this.cell_size;
            this.scrollY = Math.min(this.scrollY, 0);
            this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.height, 0) * -1);

            // console.log(this.scrollY, this.max_height - this.height);
            // this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.height, 0));
        };
    }

    // Init
    init() {
        //
        let all_blocks = BLOCK.getAll().filter((i) => {
            return (i.id > 0) && i.spawnable;
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
            let lblSlot = new CraftTableInventorySlot(x, y, sz, sz, 'lblCollectionSlot' + (i), null, '' + i, this.parent, null);
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
        for(let id of Object.keys(this.list)) {
            let lblSlot = this.list[id];
            lblSlot.drawOrig(ctx, ax + 16, ay + 34 + this.scrollY);
        }
        ctx.restore();
    }

}

export class CreativeInventoryWindow extends Window {

    constructor(x, y, w, h, id, title, text, inventory) {

        super(x, y, w, h, id, title, text);

        this.inventory = inventory;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/creative_inventory/tab_items.png');
        ct.hide();

        this.dragItem = null;

        // Ширина / высота слота
        this.cell_size = 36;

        // Add buttons
        this.addCloseButton();

        // Add labels to window
        let lbl1 = new Label(17, 12, 230, 30, 'lbl1', null, 'Creative inventory');
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
            // Drag
            let dragItem = this.getRoot().drag.getItem();
            if(dragItem) {
                this.inventory.increment(dragItem.item);
            }
            this.getRoot().drag.clear();
        }

    }

    addCloseButton() {
        const ct = this;
        // Close button
        let btnClose = new Button(ct.width - this.cell_size, 10, 20, 20, 'btnClose', '×');
        btnClose.onDrop = btnClose.onMouseDown = function(e) {
            ct.hide();
            Game.world.saveToDB();
        }
        ct.add(btnClose);
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
        let sx          = 16;
        let sy          = this.height - this.cell_size - 14;
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
        this.collection = new CreativeInventoryCollection(16, 35, this.cell_size * 9, this.cell_size * 9, 'wCollectionSlots');
        this.add(this.collection);
        this.collection.init();
    }

    // Return inventory slots
    getSlots() {
        return this.inventory_slots;
    }

}