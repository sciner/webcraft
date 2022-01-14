import {BLOCK} from "../blocks.js";
import {Button, Label} from "../../tools/gui/wm.js";
import {BaseCraftWindow, CraftTableRecipeSlot} from "./base_craft_window.js";

// CraftTable
export class CraftTable extends BaseCraftWindow {

    constructor(recipes, x, y, w, h, id, title, text, inventory) {

        super(x, y, w, h, id, title, text);
        this.width *= this.zoom;
        this.height *= this.zoom;

        this.recipes = recipes;
        this.inventory = inventory;
        this.dragItem = null;

        // Craft area
        this.area = {
            size: {
                width: 3,
                height: 3
            }
        };

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-crafting-table.png');

        // Add buttons
        this.addRecipesButton();

        // onShow
        this.onShow = function() {
            Game.releaseMousePointer();
        }

        // Ширина / высота слота
        this.cell_size = 36 * this.zoom;

        // Создание слотов для крафта
        this.createCraft(this.cell_size);

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);

        // Итоговый слот (то, что мы получим)
        this.createResultSlot(246 * this.zoom, 68 * this.zoom);

        // Обработчик закрытия формы
        this.onHide = function() {
            // Close recipe window
            Game.hud.wm.getWindow('frmRecipe').hide();
            this.clearCraft();
        }

        // Add labels to window
        let lbl1 = new Label(59 * this.zoom, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Crafting');
        let lbl2 = new Label(16 * this.zoom, 144 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl2', null, 'Inventory');
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

    }

    // Recipes button
    addRecipesButton() {
        const ct = this;
        let btnRecipes = new Button(10 * this.zoom, 68 * this.zoom, 40 * this.zoom, 36 * this.zoom, 'btnRecipes', null);
        btnRecipes.tooltip = 'Toggle recipes';
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
        let sx          = 58 * this.zoom;
        let sy          = 32 * this.zoom;
        let xcnt        = 3;
        this.craft = {
            slots: [null, null, null, null, null, null, null, null, null]
        };
        for(let i = 0; i < ct.craft.slots.length; i++) {
            let lblSlot = new CraftTableRecipeSlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (36 * this.zoom), sz, sz, 'lblCraftRecipeSlot' + i, null, '' + i, this, null);
            lblSlot.is_craft_slot = true;
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
        let craft_result = this.recipes.crafting_shaped.searchRecipeResult(pattern_array);
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
            craft_result = this.recipes.crafting_shaped.searchRecipeResult(pattern_array2);
        }
        if(!craft_result) {
            return this.resultSlot.setItem(null);
        }
        let block = Object.assign({count: craft_result.count}, BLOCK.fromId(craft_result.item_id));
        delete(block.texture);
        this.resultSlot.setItem(block);
    }

    getSlots() {
        return this.craft.slots;
    }

}