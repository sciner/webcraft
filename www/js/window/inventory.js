import {Window, Label, Button} from "../../tools/gui/wm.js";
import {CraftTableRecipeSlot, CraftTableInventorySlot, CraftTableResultSlot} from "./craft_table.js";
import RECIPES from "../recipes.js";
import {BLOCK} from "../blocks.js";

export default class InventoryWindow extends Window {

    constructor(x, y, w, h, id, title, text, inventory) {

        super(x, y, w, h, id, title, text);

        this.inventory = inventory;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-inventory.png');
        ct.hide();

        //
        this.addPlayerBox();

        // Add buttons
        this.addCloseButton();

        this.dragItem = null;

        // Add buttons
        this.addCloseButton();
        // this.addRecipesButton();

        // Ширина / высота слота
        this.cell_size = 36;

        // Создание слотов для крафта
        this.createCraft(this.cell_size);

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);

        // Итоговый слот (то, что мы получим)
        this.createResultSlot();
        
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
        let lbl1 = new Label(194, 12, 80, 30, 'lbl1', null, 'Create');
        ct.add(lbl1);

    }

    addPlayerBox() {
        const ct = this;
        let lblPlayerBox = new Label(52, 16, 98, 140, 'lblPlayerBox', null, null);
        // lblPlayerBox.setBackground('./media/gui/player.png');
        lblPlayerBox.setBackground(Game.skins.getURLById(Game.skin.id).replace('/skins/', '/skins/preview/'), 'stretch');
        ct.add(lblPlayerBox);
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
        let sx          = 194;
        let sy          = 34;
        let xcnt        = 2;
        this.craft = {
            slots: [null, null, null, null]
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
        let lblResultSlot = this.resultSlot = new CraftTableResultSlot(306, 54, this.cell_size, this.cell_size, 'lblCraftResultSlot', null, null, ct);
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
        for(let i in this.craft.slots) {
            let slot = this.craft.slots[i];
            if(!slot.item) {
                if(pattern_array.length > 0) {
                    pattern_array.push(null);
                }
            } else {
                pattern_array.push(slot.item.id);
            }
            if(i % 2 == 1) {
                pattern_array.push(null);
            }
        }
        pattern_array = pattern_array.join(' ').trim().split(' ').map(x => x ? parseInt(x) : null);
        let craft_result = RECIPES.crafting_shaped.searchRecipeResult(pattern_array);
        if(!craft_result) {
            return this.resultSlot.setItem(null);
        }
        let block = Object.assign({count: craft_result.count}, BLOCK.fromId(craft_result.item_id));
        delete(block.texture);
        this.resultSlot.setItem(block);
    }

}