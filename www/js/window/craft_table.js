import {Window, Label, Button} from "../../tools/gui/wm.js";
import RECIPES from "../recipes.js";
import {BLOCK} from "../blocks.js";

class CraftTableSlot extends Label {

    constructor(x, y, w, h, id, title, text, ct, slot_index) {
        super(x, y, w, h, id, null, null);
        this.ct = ct;
        this.setSlotIndex(slot_index);
    }

    setItem(item) {
        if(this.slot_index !== null) {
            Game.world.localPlayer.inventory.setItem(this.slot_index, item);
        } else {
            this.item = item;
        }
    }

    getItem() {
        if(this.slot_index !== null) {
            return Game.world.localPlayer.inventory.items[this.slot_index];
        } else {
            return this.item;
        }
    }

    draw(ctx, ax, ay) {
        this.applyStyle(ctx, ax, ay);
        let item = this.getItem();
        this.drawItem(ctx, item, ax + this.x, ay + this.y, this.width, this.height);
        super.draw(ctx, ax, ay);
    }

    drawItem(ctx, item, x, y, width, height) {
        if(!this.ct.inventory.inventory_image) {
            return;
        }
        if(!item) {
            return;
        }
        ctx.imageSmoothingEnabled = false;
        // 
        if('inventory_icon_id' in item) {
            let icon = BLOCK.getInventoryIconPos(item.inventory_icon_id);
            ctx.drawImage(
                this.ct.inventory.inventory_image,
                icon.x,
                icon.y,
                icon.width,
                icon.height,
                x + width / 2 - icon.width / 2,
                y + height / 2 - icon.height / 2,
                32,
                32
            );
        } else {
            ctx.textBaseline    = 'top';
            ctx.textAlign       = 'left';
            ctx.font            = '11px Minecraftia';
            let text            = item.name.substring(0, 4);
            ctx.fillStyle       = '#000000ff';
            ctx.fillText(text, x + 2, y + 2);
            ctx.fillStyle       = '#ffffffff';
            ctx.fillText(text, x + 1, y + 1);
        }
        // ctx.save();
        if(item.count > 1) {
            ctx.textBaseline        = 'bottom';
            ctx.textAlign           = 'right';
            ctx.font                = '18px Minecraftia';
            ctx.fillStyle           = '#000000ff';
            ctx.fillText(item.count, x + width + 2, y + height + 2);
            ctx.fillStyle           = '#ffffffff';
            ctx.fillText(item.count, x + width, y + height);
        }
        // ctx.restore();
    }

    setSlotIndex(index) {
        this.slot_index = index;
    }

}

export class CraftTableInventorySlot extends CraftTableSlot {

    constructor(x, y, w, h, id, title, text, ct, slot_index) {
        
        super(x, y, w, h, id, title, text, ct, slot_index);

        // Custom drawing
        this.onMouseEnter = function() {
            this.style.background.color = '#ffffff55';
        }

        this.onMouseLeave = function() {
            this.style.background.color = '#00000000';
        }

        // Drag & drop
        this.onMouseDown = function(e) {
            let that        = this;
            const MAX_COUNT = 64;
            //
            let targetItem  = this.getInventoryItem();
            // Set new drag
            if(!targetItem) {
                return;
            }
            if(e.drag.getItem()) {
                return;
            }
            let dragItem = targetItem;
            // right button (divide to 2)
            if(e.button == MOUSE.BUTTON_RIGHT && targetItem.count > 1) {
                let split_count = Math.ceil(targetItem.count / 2);
                dragItem = {...targetItem};
                dragItem.count = split_count;
                targetItem.count -= split_count;
                this.setItem(targetItem);
            } else {
                dragItem = targetItem;
                that.setItem(null);
            }
            that.dragItem = dragItem;
            e.drag.setItem({
                draw: function(e) {
                    that.drawItem(e.ctx, this.item, e.x, e.y, that.width, that.height);
                },
                item: dragItem
            });
            this.prev_mousedown_time = performance.now();
        }

        // Drag & drop
        this.onDrop = function(e) {
            const MAX_COUNT = 64;
            let that        = this;
            let drag        = e.drag;
            // @todo check instanceof!
            // if(dropData instanceof InventoryItem) {
            let dropData    = drag.getItem();
            let targetItem  = this.getInventoryItem();
            if(!dropData) {
                return;
            }
            if(this.prev_mousedown_time && e.button === MOUSE.BUTTON_LEFT && !e.shiftKey) {
                // 1. Объединение мелких ячеек в одну при двойном клике на ячейке
                if(performance.now() - this.prev_mousedown_time < 200.0 && dropData.item.count < MAX_COUNT) {
                    let need_count = MAX_COUNT - dropData.item.count;
                    // console.log('dropData', dropData, need_count, this.parent.craft.slots);
                    // проверить крафт слоты
                    let craft_slots = this.parent.craft.slots;
                    for(let i in craft_slots) {
                        if(need_count == 0) {
                            break;
                        }
                        const slot = craft_slots[i];
                        if(slot && slot.item) {
                            if(slot.item.id == dropData.item.id) {
                                if(slot.item.count != MAX_COUNT) {
                                    let minus_count = 0;
                                    if(slot.item.count < need_count) {
                                        minus_count = slot.item.count;
                                    } else {
                                        minus_count = need_count;
                                    }
                                    need_count -= minus_count;
                                    dropData.item.count += minus_count;
                                    slot.item.count -= minus_count;
                                    if(slot.item.count < 1) {
                                        craft_slots[i].item = null;
                                    }
                                }
                            }
                        }
                    }
                    // проверить слоты инвентаря
                    let inventory_items = Game.world.localPlayer.inventory.items;
                    for(let i in inventory_items) {
                        if(need_count == 0) {
                            break;
                        }
                        const item = inventory_items[i];
                        if(item) {
                            if(item.id == dropData.item.id) {
                                if(item.count != MAX_COUNT) {
                                    let minus_count = 0;
                                    if(item.count < need_count) {
                                        minus_count = item.count;
                                    } else {
                                        minus_count = need_count;
                                    }
                                    need_count -= minus_count;
                                    dropData.item.count += minus_count;
                                    item.count -= minus_count;
                                    if(item.count < 1) {
                                        inventory_items[i] = null;
                                    }
                                }
                            }
                        }
                    }
                    return;
                }
            }
            if(!dropData.item) {
                return;
            }
            // Если в текущей ячейке что-то есть
            if(targetItem) {
                // @todo
                if(targetItem.id == dropData.item.id) {
                    if(targetItem.count < MAX_COUNT) {
                        if(e.button == MOUSE.BUTTON_RIGHT && dropData.item.count > 1) {
                            targetItem.count++;
                            dropData.item.count--;
                        } else {
                            let new_count = targetItem.count + dropData.item.count;
                            let remains = 0;
                            if(new_count > MAX_COUNT) {
                                remains = new_count - MAX_COUNT;
                                new_count = MAX_COUNT;
                            }
                            targetItem.count = new_count;
                            dropData.item.count = remains;
                            if(dropData.item.count <= 0) {
                                drag.clear();
                            }
                        }
                        this.setItem(targetItem);
                    }
                } else {
                    // поменять местами перетаскиваемый элемент и содержимое ячейки
                    this.setItem(dropData.item);
                    dropData.item = targetItem;
                }
            } else {
                // Перетаскивание в пустую ячейку
                if(e.button == MOUSE.BUTTON_RIGHT && dropData.item.count > 1) {
                    let newItem = {...dropData.item};
                    newItem.count = 1;
                    that.setItem(newItem);
                    dropData.item.count--;
                } else {
                    that.setItem(dropData.item);
                    drag.clear();
                }
            }
        }

    }

    draw(ctx, ax, ay) {
        this.applyStyle(ctx, ax, ay);
        let item = this.getInventoryItem();
        this.drawItem(ctx, item, ax + this.x, ay + this.y, this.width, this.height);
        super.draw(ctx, ax, ay);
    }

    getInventoryItem() {
        return this.ct.inventory.items[this.slot_index] || this.item;
    }
    
}

// Ячейка рецепта
export class CraftTableRecipeSlot extends CraftTableInventorySlot {

    // Вызывается после изменения любой из её ячеек
    setItem(item) {
        super.setItem(item);
        this.parent.checkRecipe();
    }

}

//
export class CraftTableResultSlot extends CraftTableSlot {

    constructor(x, y, w, h, id, title, text, ct) {

        super(x, y, w, h, id, title, text, ct, null);

        this.onDrop = function(e) {
            let that = this;
            let dragItem = this.getItem();
            let dropItem = e.drag.getItem().item;
            if(!dragItem || !dropItem) {
                return;
            }
            if(dragItem.id != dropItem.id) {
                return;
            }
            // decrement craft slots
            for(let slot of this.parent.craft.slots) {
                let item = slot.getItem();
                if(item) {
                    item.count--;
                    if(item.count == 0) {
                        slot.setItem(null);
                    }
                }
            }
            //
            const MAX_COUNT = 64;
            if(dropItem.count + dragItem.count < MAX_COUNT) {
                dropItem.count += dragItem.count;
                // clear result slot
                this.setItem(null);
            } else {
                let remains = (dropItem.count + dragItem.count) - MAX_COUNT;
                dropItem.count = MAX_COUNT;
                dragItem.count = remains;
            }
            this.parent.checkRecipe();
        }

        // Drag & drop
        this.onMouseDown = function(e) {
            let that = this;
            let dragItem = this.getItem();
            if(!dragItem) {
                return;
            }
            // clear result slot
            this.setItem(null);
            // decrement craft slots
            for(let slot of this.parent.craft.slots) {
                let item = slot.getItem();
                if(item) {
                    item.count--;
                    if(item.count == 0) {
                        slot.setItem(null);
                    }
                }
            }
            // set drag item
            e.drag.setItem({
                draw: function(e) {
                    that.drawItem(e.ctx, dragItem, e.x, e.y, that.width, that.height);
                },
                item: dragItem
            });
            this.parent.checkRecipe();
        }
    
    }
    
}

export class CraftTable extends Window {

    constructor(x, y, w, h, id, title, text, inventory) {

        super(x, y, w, h, id, title, text);

        this.inventory = inventory;
        this.dragItem = null;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-crafting-table.png');
        ct.hide();

        // onShow
        this.onShow = function() {
            Game.releaseMousePointer();
        }

        // Add buttons
        this.addCloseButton();
        this.addRecipesButton();

        // Ширина / высота слота
        this.cell_size = 36;

        // Создание слотов для крафта
        this.createCraft(this.cell_size);

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);

        // Итоговый слот (то, что мы получим)
        this.createResultSlot();
        
        // Обработчик закрытия формы
        this.onHide = function() {
            // Drag
            let dragItem = this.getRoot().drag.getItem();
            if(dragItem) {
                this.inventory.increment(dragItem.item);
            }
            this.getRoot().drag.clear();
            // Clear result
            this.resultSlot.setItem(null);
            //
            for(let slot of this.craft.slots) {
                if(slot && slot.item) {
                    this.inventory.increment(slot.item);
                    slot.item = null;
                }
            }
        }

        // Add labels to window
        let lbl1 = new Label(59, 12, 80, 30, 'lbl1', null, 'Crafting');
        let lbl2 = new Label(16, 144, 80, 30, 'lbl2', null, 'Inventory');
        ct.add(lbl1);
        ct.add(lbl2);

    }

    addCloseButton() {
        const ct = this;
        // Close button
        let btnClose = new Button(ct.width - 40, 20, 20, 20, 'btnClose', '×');
        btnClose.onDrop = btnClose.onMouseDown = function(e) {
            ct.hide();
        }
        ct.add(btnClose);
    }

    // Recipes button
    addRecipesButton() {
        const ct = this;
        let btnRecipes = new Button(10, 68, 40, 36, 'btnRecipes', null);
        btnRecipes.setBackground('./media/gui/recipes.png');
        btnRecipes.onMouseDown = function(e) {
            // ct.hide();
        }
        ct.add(btnRecipes);
    }
    
    /**
    * Создание слотов для крафта
    * @param int sz Ширина / высота слота
    */
    createCraft(sz) {
        const ct = this;
        if(ct.craft) {
            console.error('createCraftSlots() already created');
            return;
        }
        let sx          = 58;
        let sy          = 32;
        let xcnt        = 3;
        this.craft = {
            slots: [null, null, null, null, null, null, null, null, null]
        };
        for(let i = 0; i < ct.craft.slots.length; i++) {
            let lblSlot = new CraftTableRecipeSlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * 36, sz, sz, 'lblCraftRecipeSlot' + i, null, '' + i, this, null);
            lblSlot.onMouseEnter = function() {
                this.style.background.color = '#ffffff33';
            }
            lblSlot.onMouseLeave = function() {
                this.style.background.color = '#00000000';
            }
            ct.add(this.craft.slots[i] = lblSlot);
        }
    }
    
    /**
    * Итоговый слот (то, что мы получим)
    */
    createResultSlot() {
        const ct = this;
        // x, y, w, h, id, title, text, ct, slot_index
        let lblResultSlot = this.resultSlot = new CraftTableResultSlot(246, 68, this.cell_size, this.cell_size, 'lblCraftResultSlot', null, null, ct);
        lblResultSlot.onMouseEnter = function() {
            this.style.background.color = '#ffffff33';
        }
        lblResultSlot.onMouseLeave = function() {
            this.style.background.color = '#00000000';
        }
        ct.add(lblResultSlot);
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
        let sx          = 14;
        let sy          = 282;
        let xcnt        = 9;
        for(let i = 0; i < 9; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * 36, sz, sz, 'lblSlot' + (i), null, '' + i, this, i);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
        sx              = 14;
        sy              = 166;
        xcnt            = 9;
        // верхние 3 ряда
        for(let i = 0; i < 27; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * 36, sz, sz, 'lblSlot' + (i + 9), null, '' + (i + 9), this, i + 9);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
    }
    
    // собираем и проверяем шаблон
    checkRecipe() {
        let pattern_array = [];
        for(let slot of this.craft.slots) {
            if(!slot.item) {
                if(pattern_array.length > 0) {
                    pattern_array.push(null);
                }
            } else {
                pattern_array.push(slot.item.id);
            }
        }
        pattern_array = pattern_array.join(' ').trim().split(' ').map(x => x ? parseInt(x) : null);
        let craft_result = RECIPES.crafting_shaped.searchRecipeResult(pattern_array);
        if(!craft_result) {
            let pattern_array2 = [];
            // 2. Mirrored
            for(let i = 0; i < 3; i++) {
                for(let j = 2; j >= 0; j--) {
                    let slot = this.craft.slots[i * 3 + j];
                    if(!slot.item) {
                        if(pattern_array.length > 0) {
                            pattern_array2.push(null);
                        }
                    } else {
                        pattern_array2.push(slot.item.id);
                    }
                }
            }
            pattern_array2 = pattern_array2.join(' ').trim().split(' ').map(x => x ? parseInt(x) : null);
            craft_result = RECIPES.crafting_shaped.searchRecipeResult(pattern_array2);
        }
        if(!craft_result) {
            return this.resultSlot.setItem(null);
        }
        let block = Object.assign({count: craft_result.count}, BLOCK.fromId(craft_result.item_id));
        delete(block.texture);
        this.resultSlot.setItem(block);
    }

}