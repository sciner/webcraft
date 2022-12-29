import { Button, Label } from "../../tools/gui/wm.js";
import { BaseCraftWindow, CraftTableRecipeSlot, CraftTableSlot } from "./base_craft_window.js";
import { BLOCK } from "../blocks.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE, INVENTORY_DRAG_SLOT_INDEX } from "../constant.js";

class ArmorSlot extends CraftTableSlot {
    
    constructor(x, y, s, id, ct) {
        
        super(x, y, s, s, 'lblSlot' + id, null, null, ct, id);
        // Custom drawing
        this.onMouseEnter = function(e) {
            this.style.background.color = '#ffffff55';
        }

        this.onMouseLeave = function() {
            this.style.background.color = '#00000000';
        }

        // Drag
        this.onMouseDown = function(e) {
            const targetItem  = this.getInventoryItem();
            if(!targetItem || e.drag.getItem()) {
                return;
            }
            this.setItem(null, e);
            this.getInventory().setDragItem(this, targetItem, e.drag, this.width, this.height);
        }
        
        this.onDrop = function(e) {
            const dropData    = e.drag.getItem();
            const targetItem  = this.getInventoryItem();
            if(!dropData) {
               return;
            }
            const item = BLOCK.fromId(dropData.item.id);
            if (item?.item?.name != 'armor' || item.armor.slot != this.slot_index) {
                return;
            }
            this.setItem(dropData.item, e);
            if (targetItem) {
                Qubatch.player.inventory.items[INVENTORY_DRAG_SLOT_INDEX] = targetItem;
                dropData.item = targetItem;
            } else {
                this.getInventory().clearDragItem();
            }
        }
    }
    
    draw(ctx, ax, ay) {
        this.applyStyle(ctx, ax, ay);
        const item = this.getInventoryItem();
        if(item) {
            // fill background color
            let x = ax + this.x;
            let y = ay + this.y;
            let w = this.width;
            let h = this.height;
            ctx.fillStyle = '#8f8d88ff';
            ctx.fillRect(x, y, w, h);
        }
        this.drawItem(ctx, item, ax + this.x, ay + this.y, this.width, this.height);
        super.draw(ctx, ax, ay);
    }

    getInventory() {
        return this.ct.inventory;
    }
    
    getInventoryItem() {
        return this.ct.inventory.items[this.slot_index] || this.item;
    }
    
}
import { skinview3d } from "../../vendors/skinview3d.bundle.js"

const PLAYER_BOX_WIDTH = 98;
const PLAYER_BOX_HEIGHT = 140;

export class InventoryWindow extends BaseCraftWindow {

    /**
     * 
     * @param { import("../player_inventory.js").PlayerInventory } inventory
     * @param {*} recipes 
     */
    constructor(inventory, recipes) {

        super(10, 10, 352, 332, 'frmInventory', null, null);

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

        this.skinKey = null;
        this.skinViewer = null; // lazy initialized if necessary

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

        // Add buttons
        this.addRecipesButton();

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Создание слотов для крафта
        this.createCraft(this.cell_size);

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);
        
        // Создания слота для армора
        this.createArmorSlots(this.cell_size);

        // Итоговый слот (то, что мы получим)
        this.createResultSlot(306 * this.zoom, 54 * this.zoom);
        
        // Обработчик открытия формы
        this.onShow = function() {
            Qubatch.releaseMousePointer();
            this.previewSkin();
        }

        // Обработчик закрытия формы
        this.onHide = function() {
            // Close recipe window
            Qubatch.hud.wm.getWindow('frmRecipe').hide();
            // Drag
            this.inventory.clearDragItem(true);
            // Clear result
            this.lblResultSlot.setItem(null);
            //
            for(let slot of this.craft.slots) {
                if(slot && slot.item) {
                    this.inventory.increment(slot.item);
                    slot.setItem(null);
                }
            }
            // Update player mob model
            this.inventory.player.updateArmor()
            // Save inventory
            Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), this.lblResultSlot.getUsedRecipes());

            this.skinViewer.renderPaused = true;
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

    previewSkin() {
        const that = this;
        function drawOneFrame() {
            that.skinViewer.draw();
            that.skinViewer.renderPaused = true;
        }

        if (!this.skinViewer) {
            const animation = new skinview3d.WalkingAnimation();
            animation.progress = 0.7;
            animation.paused = true;
            const skinViewer = new skinview3d.SkinViewer({
                canvas: this.skinViewerCanvas,
                width: this.skinViewerCanvas.width,
                height: this.skinViewerCanvas.height,
                animation: null
            });
            skinViewer.camera.position.x = 20;
            skinViewer.camera.position.y = 15;
            skinViewer.camera.position.z = 40;
            skinViewer.zoom = 1;
            skinViewer.fov = 30;
            skinViewer.renderPaused = true;
            this.skinViewer = skinViewer;
        }
        // set or reset the pose
        this.skinViewer.animation = null;
        const s = this.skinViewer.playerObject.skin;
        s.leftArm.rotation.x = -0.2;
        s.rightArm.rotation.x = 0.2;
        s.leftLeg.rotation.x = 0.3;
        s.rightLeg.rotation.x = -0.3;

        const skin = Qubatch.render.player.state.skin;
        const skinKey = skin.file + '_' + skin.type;
        if (this.skinKey !== skinKey) {
            this.skinKey = skinKey;
            const model = skin.type ? 'slim' : 'default';
            // use the cached skin image, if available
            const img = Qubatch.world.players.getMyself()?.skinImage;
            // it doesn't return a promise when an image is supplied
            this.skinViewer.loadSkin(img || skin.file, {model})?.then(drawOneFrame);
            if (img) {
                drawOneFrame();
            }
        } else {
            drawOneFrame();
        }
    }

    addPlayerBox() {
        const ct = this;
        this.lblPlayerBox = new Label(52 * this.zoom, 16 * this.zoom,
            PLAYER_BOX_WIDTH * this.zoom, PLAYER_BOX_HEIGHT * this.zoom,
            'lblPlayerBox', null, null);

        this.skinViewerCanvas = document.createElement('canvas');
        this.skinViewerCanvas.width = PLAYER_BOX_WIDTH * this.zoom;
        this.skinViewerCanvas.height = PLAYER_BOX_HEIGHT * this.zoom;
        this.lblPlayerBox.setBackground(this.skinViewerCanvas, 'stretch');
        this.lblPlayerBox.onMouseDown = () => {
            this.skinViewer.animation = this.skinViewer.animation || new skinview3d.WalkingAnimation();
            this.skinViewer.renderPaused = !this.skinViewer.renderPaused;
        }
        ct.add(this.lblPlayerBox);
    }

    // Recipes button
    addRecipesButton() {
        const ct = this;
        let btnRecipes = new Button(208 * this.zoom, 122 * this.zoom, 40 * this.zoom, INVENTORY_SLOT_SIZE * this.zoom, 'btnRecipes', null);
        btnRecipes.tooltip = Lang.toggle_recipes;
        btnRecipes.setBackground('./media/gui/recipes.png', 'none');
        btnRecipes.onMouseDown = (e) => {
            let frmRecipe = Qubatch.hud.wm.getWindow('frmRecipe');
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
    checkRecipe(area_size) {
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
        }
        pattern_array = pattern_array.join(' ').trim().split(' ').map(x => x ? parseInt(x) : null);
        this.lblResultSlot.recipe = this.recipes.crafting_shaped.searchRecipe(pattern_array, area_size);
        let craft_result = this.lblResultSlot.recipe?.result || null;
        if(!craft_result) {
            return this.lblResultSlot.setItem(null);
        }
        const block = BLOCK.convertItemToInventoryItem(BLOCK.fromId(craft_result.item_id), null, true);
        block.count = craft_result.count;
        this.lblResultSlot.setItem(block);
    }

    getSlots() {
        return this.inventory_slots;
    }
    
    createArmorSlots(sz) {
        const ct = this;
        const lblSlotHead = new ArmorSlot(16.5 * this.zoom, 16 * this.zoom, 32 * this.zoom, 39, this);
        ct.add(lblSlotHead);
        ct.inventory_slots.push(lblSlotHead);
        const lblSlotChest = new ArmorSlot(16.5 * this.zoom, 52 * this.zoom, 32 * this.zoom, 38, this);
        ct.add(lblSlotChest);
        ct.inventory_slots.push(lblSlotChest);
        const lblSlotLeggs = new ArmorSlot(16.5 * this.zoom, 88 * this.zoom, 32 * this.zoom, 37, this);
        ct.add(lblSlotLeggs);
        ct.inventory_slots.push(lblSlotLeggs);
        const lblSlotBoots = new ArmorSlot(16.5 * this.zoom, 123 * this.zoom, 32 * this.zoom, 36, this);
        ct.add(lblSlotBoots);
        ct.inventory_slots.push(lblSlotBoots);
    }

}