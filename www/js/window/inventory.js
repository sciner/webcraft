import {Button, Label} from "../../tools/gui/wm.js";
import {BaseCraftWindow, CraftTableRecipeSlot} from "./base_craft_window.js";
import {BLOCK} from "../blocks.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";

export default class InventoryWindow extends BaseCraftWindow {

    constructor(recipes, x, y, w, h, id, title, text, inventory) {

        super(x, y, w, h, id, title, text);

        this.width *= this.zoom;
        this.height *= this.zoom;
        this.style.background.image_size_mode = 'stretch';

        this.recipes = recipes;
        this.inventory = inventory;

        const options = {
            background: {
                image: './media/gui/form-inventory.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 0,
                    width: 352 * 2,
                    height: 332 * 2
                }
            }
        };
        this.style.background = {...this.style.background, ...options.background};

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground(options.background.image);



        ct.hide();
        
        // Craft area
        this.area = {
            size: {
                width: 2,
                height: 2
            }
        };

        //
        this.addPlayerBox();

        this.dragItem = null;

        // Add buttons
        this.addRecipesButton();

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Создание слотов для крафта
        this.createCraft(this.cell_size);

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);

        // Итоговый слот (то, что мы получим)
        this.createResultSlot(306 * this.zoom, 54 * this.zoom);
        
        // Обработчик открытия формы
        this.onShow = function() {
            Game.releaseMousePointer();
        }

        // Обработчик закрытия формы
        this.onHide = function() {
            // Close recipe window
            Game.hud.wm.getWindow('frmRecipe').hide();
            // Drag
            let dragItem = this.getRoot().drag.getItem();
            if(dragItem) {
                this.inventory.increment(dragItem.item);
            }
            this.getRoot().drag.clear();
            // Clear result
            this.lblResultSlot.setItem(null);
            //
            for(let slot of this.craft.slots) {
                if(slot && slot.item) {
                    this.inventory.increment(slot.item);
                    slot.setItem(null);
                }
            }
            // Save inventory
            Game.world.server.InventoryNewState(this.inventory.exportItems(), this.lblResultSlot.getUsedRecipes());
        }

        // Add labels to window
        let lbl1 = new Label(194 * this.zoom, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl1', null, Lang.create);
        ct.add(lbl1);

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            let btnClose = new Button(ct.width - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image = image;
            // btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                ct.hide();
            }
            ct.add(btnClose);
        });

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.E:
                case KEY.ESC: {
                    if(!down) {
                        ct.hide();
                        try {
                            Game.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    return true;
                }
            }
            return false;
        }

    }

    addPlayerBox() {
        const ct = this;
        let lblPlayerBox = new Label(52 * this.zoom, 16 * this.zoom, 98 * this.zoom, 140 * this.zoom, 'lblPlayerBox', null, null);
        lblPlayerBox.setBackground(Game.skin.preview, 'stretch');
        ct.add(lblPlayerBox);
    }

    // Recipes button
    addRecipesButton() {
        const ct = this;
        let btnRecipes = new Button(208 * this.zoom, 122 * this.zoom, 40 * this.zoom, INVENTORY_SLOT_SIZE * this.zoom, 'btnRecipes', null);
        btnRecipes.tooltip = Lang.toggle_recipes;
        btnRecipes.setBackground('./media/gui/recipes.png', 'none');
        btnRecipes.onMouseDown = (e) => {
            let frmRecipe = Game.hud.wm.getWindow('frmRecipe');
            frmRecipe.assignCraftWindow(this);
            frmRecipe.toggleVisibility();
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
        let sx          = 194 * this.zoom;
        let sy          = 34 * this.zoom;
        let xcnt        = 2;
        this.craft = {
            slots: [null, null, null, null]
        };
        for(let i = 0; i < ct.craft.slots.length; i++) {
            let lblSlot = new CraftTableRecipeSlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * INVENTORY_SLOT_SIZE * this.zoom, sz, sz, 'lblCraftRecipeSlot' + i, null, '' + i, this, null);
            lblSlot.onMouseEnter = function() {
                this.style.background.color = '#ffffff33';
            }
            lblSlot.onMouseLeave = function() {
                this.style.background.color = '#00000000';
            }
            ct.add(this.craft.slots[i] = lblSlot);
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
        this.lblResultSlot.recipe = this.recipes.crafting_shaped.searchRecipe(pattern_array);
        let craft_result = this.lblResultSlot.recipe?.result || null;
        if(!craft_result) {
            return this.lblResultSlot.setItem(null);
        }
        let block = Object.assign({count: craft_result.count}, BLOCK.fromId(craft_result.item_id));
        delete(block.texture);
        this.lblResultSlot.setItem(block);
    }

    getSlots() {
        return this.inventory_slots;
    }

}