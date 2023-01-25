import {BLOCK} from "../blocks.js";
import {Button, Label} from "../../tools/gui/wm.js";
import {BaseCraftWindow, CraftTableRecipeSlot} from "./base_craft_window.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";

// CraftTable
export class CraftTable extends BaseCraftWindow {

    constructor(inventory, recipes) {

        super(0, 0, 352, 332, 'frmCraft', null, null, inventory);

        this.w *= this.zoom
        this.h *= this.zoom

        this.recipes = recipes

        // Craft area
        this.area = {
            size: {
                width: 3,
                height: 3
            }
        }

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-crafting-table.png').then(async atlas => {
            this.setBackground(await atlas.getSprite(0, 0, 352 * 2, 332 * 2), 'none', this.zoom / 2.0)
        })

        // Add buttons
        this.addRecipesButton()

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Создание слотов для крафта
        this.createCraft(this.cell_size);

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);

        // Итоговый слот (то, что мы получим)
        this.createResultSlot(246 * this.zoom, 68 * this.zoom);
        
        // слоты (лабел) для подсказок
        this.addHelpSlots()

        // Add labels to window
        const lbl1 = new Label(59 * this.zoom, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Crafting');
        const lbl2 = new Label(16 * this.zoom, 144 * this.zoom, 120 * this.zoom, 30 * this.zoom, 'lbl2', null, 'Inventory');
        this.add(lbl1)
        this.add(lbl2)

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const that = this
            // Close button
            const btnClose = new Button(that.w - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image = image;
            btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                that.hide();
            }
            that.add(btnClose)
        })

    }

    // onShow
    onShow() {
        Qubatch.releaseMousePointer()
        this.setHelperSlots(null)
        super.onShow()
    }

    // Обработчик закрытия формы
    onHide() {
        // Close recipe window
        this.getRoot().getWindow('frmRecipe').hide()
        this.clearCraft()
        // Save inventory
        Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), this.lblResultSlot.getUsedRecipes())
        super.onHide()
    }

    // Recipes button
    addRecipesButton() {
        const ct = this;
        let btnRecipes = new Button(10 * this.zoom, 68 * this.zoom, 40 * this.zoom, INVENTORY_SLOT_SIZE * this.zoom, 'btnRecipes', null);
        btnRecipes.tooltip = 'Toggle recipes';
        btnRecipes.setBackground('./media/gui/recipes.png', 'centerstretch', .5);
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