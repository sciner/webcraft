import {BLOCK} from "../blocks.js";
import {Button, Label} from "../../tools/gui/wm.js";
import {BaseCraftWindow, CraftTableRecipeSlot} from "./base_craft_window.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";

// CraftTable
export class CraftTable extends BaseCraftWindow {

    constructor(inventory, recipes) {

        super(0, 0, 352, 332, 'frmCraft', null, null, inventory);

        this.w *= this.zoom;
        this.h *= this.zoom;
        this.style.background.image_size_mode = 'stretch';

        this.recipes = recipes;

        // Craft area
        this.area = {
            size: {
                width: 3,
                height: 3
            }
        };

        const options = {
            background: {
                image: './media/gui/form-crafting-table.png',
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

        // Add buttons
        this.addRecipesButton();

        // onShow
        this.onShow = function() {
            Qubatch.releaseMousePointer();
            this.setHelperSlots(null);
        }

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Создание слотов для крафта
        this.createCraft(this.cell_size);

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);

        // Итоговый слот (то, что мы получим)
        this.createResultSlot(246 * this.zoom, 68 * this.zoom);
        
        // слоты (лабел) для подсказок
        this.addHelpSlots();

        // Обработчик закрытия формы
        this.onHide = function() {
            // Close recipe window
            ct.getRoot().getWindow('frmRecipe').hide();
            this.clearCraft();
            // Save inventory
            Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), this.lblResultSlot.getUsedRecipes());
        }

        // Add labels to window
        let lbl1 = new Label(59 * this.zoom, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Crafting');
        let lbl2 = new Label(16 * this.zoom, 144 * this.zoom, 120 * this.zoom, 30 * this.zoom, 'lbl2', null, 'Inventory');
        ct.add(lbl1);
        ct.add(lbl2);

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            let btnClose = new Button(ct.width - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
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
                case KEY.E:
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

    }

    // Recipes button
    addRecipesButton() {
        const ct = this;
        let btnRecipes = new Button(10 * this.zoom, 68 * this.zoom, 40 * this.zoom, INVENTORY_SLOT_SIZE * this.zoom, 'btnRecipes', null);
        btnRecipes.tooltip = 'Toggle recipes';
        btnRecipes.setBackground('./media/gui/recipes.png', 'none');
        btnRecipes.onMouseDown = (e) => {
            let frmRecipe = Qubatch.hud.wm.getWindow('frmRecipe');
            frmRecipe.assignCraftWindow(this);
            frmRecipe.toggleVisibility();
            this.setHelperSlots(null);
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
        let sx          = 58 * this.zoom;
        let sy          = 32 * this.zoom;
        let xcnt        = 3;
        this.craft = {
            slots: [null, null, null, null, null, null, null, null, null]
        };
        for(let i = 0; i < ct.craft.slots.length; i++) {
            const options = {
                onMouseEnterBackroundColor: '#ffffff33'
            };
            let lblSlot = new CraftTableRecipeSlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom), sz, sz,
                'lblCraftRecipeSlot' + i, null, '' + i, this, null, options);
            lblSlot.is_craft_slot = true;
            ct.add(this.craft.slots[i] = lblSlot);
        }
    }

    getSlots() {
        return this.craft.slots;
    }

}