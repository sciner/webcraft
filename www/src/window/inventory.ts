import { Button, Label } from "../../tools/gui/wm.js";
import { ArmorSlot, BaseCraftWindow, CraftTableRecipeSlot } from "./base_craft_window.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { skinview3d } from "../../vendors/skinview3d.bundle.js"
// import { SpriteAtlas } from "../core/sprite_atlas.js";
import { blobToImage } from "../helpers.js";

const PLAYER_BOX_WIDTH = 98;
const PLAYER_BOX_HEIGHT = 140;

export class InventoryWindow extends BaseCraftWindow {
    [key: string]: any;

    /**
     * @param { import("../player_inventory.js").PlayerInventory } inventory
     * @param {*} recipes
     */
    constructor(inventory, recipes) {

        super(10, 10, 700, 332, 'frmInventory', null, null, inventory)
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom
        this.recipes = recipes

        // Create sprite atlas
        // this.atlas = new SpriteAtlas()
        // this.atlas.fromFile('./media/gui/form-inventory.png').then(async atlas => {
        //     this.setBackground(await atlas.getSprite(0, 0, 352 * 2, 332 * 2), 'none', this.zoom / 2.0)
        // })

        this.skinKey = null
        this.skinViewer = null // lazy initialized if necessary

        // Craft area
        this.area = {
            size: {
                width: 2,
                height: 2
            }
        };

        //
        this.addPlayerBox()

        // // Add buttons
        // this.addRecipesButton()

        // слоты для подсказок
        this.addHelpSlots()

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom

        // Создание слотов для крафта
        this.createCraft(this.cell_size)

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size)

        // Создания слота для армора
        this.createArmorSlots(this.cell_size)

        // Итоговый слот (то, что мы получим)
        this.createResultSlot(306 * this.zoom, 54 * this.zoom)

        // Add labels to window
        const lblTitle = new Label(194 * this.zoom, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lblTitle', null, Lang.create)
        this.add(lblTitle)

        // const btnClose = new Button(this.w - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '')
        // this.add(btnClose)

        // // Add close button
        // this.loadCloseButtonImage((image) => {
        //     // Add buttons
        //     const that = this
        //     // Close button
        //     btnClose.style.font.family = 'Arial'
        //     btnClose.style.background.image = image
        //     // btnClose.style.background.image_size_mode = 'stretch';
        //     btnClose.onDrop = btnClose.onMouseDown = function(e) {
        //         that.hide()
        //     }
        // })

    }

    // Обработчик открытия формы
    onShow(args) {

        if(!this.frmRecipe) {
            const form = this.inventory.player.inventory.recipes.frmRecipe
            this.frmRecipe = form
            form.style.background.image = null
            form.parent.delete(form.id)
            form.x = 370 * this.zoom
            form.y = 0 * this.zoom
            this.add(form)
        }

        // this.getRoot().center(this)
        // Qubatch.releaseMousePointer()
        this.previewSkin()
        this.setHelperSlots(null)
        super.onShow(args)

        this.frmRecipe.assignCraftWindow(this)
        this.frmRecipe.show()
    }

    // Обработчик закрытия формы
    onHide() {
        // Close recipe window
        // this.frmRecipe.hide()
        // this.inventory.player.inventory.recipes.frmRecipe?.hide()
        // Drag
        this.inventory.clearDragItem(true)
        // Clear result
        this.lblResultSlot.setItem(null)
        //
        for(let slot of this.craft.slots) {
            if(slot && slot.item) {
                this.inventory.increment(slot.item)
                slot.setItem(null)
            }
        }
        // Update player mob model
        this.inventory.player.updateArmor()
        // Save inventory
        Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), this.lblResultSlot.getUsedRecipes())
        if(this.skinViewer) {
            this.skinViewer.renderPaused = true
        }
    }

    async previewSkin() {

        const drawOneFrame = () => {
            this.skinViewer.draw();
            this.skinViewer.renderPaused = true;
            this.skinViewerCanvas.toBlob(async blob => {
                this.lblPlayerBox.setBackground(await blobToImage(blob), 'centerstretch', .9)
            })
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

        const skin = Qubatch.render.player.skin

        if(skin) {
            const skinKey = skin.file + '_' + skin.type;
            if (this.skinKey !== skinKey) {
                this.skinKey = skinKey;
                const model = skin.type ? 'slim' : 'default';
                // use the cached skin image, if available
                const img = Qubatch.world.players.getMyself()?.skinImage;
                // it doesn't return a promise when an image is supplied
                this.skinViewer.loadSkin(img || skin.file, {model})?.then(() => drawOneFrame());
                if (img) {
                    drawOneFrame();
                }
            } else {
                drawOneFrame();
            }
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
        // this.lblPlayerBox.setBackground(this.skinViewerCanvas, 'centerstretch', .9);
        this.lblPlayerBox.onMouseDown = () => {
            this.skinViewer.animation = this.skinViewer.animation || new skinview3d.WalkingAnimation();
            this.skinViewer.renderPaused = !this.skinViewer.renderPaused;
        }
        ct.add(this.lblPlayerBox);
    }

    // // Recipes button
    // addRecipesButton() {
    //     const ct = this;
    //     let btnRecipes = new Button(208 * this.zoom, 122 * this.zoom, 40 * this.zoom, INVENTORY_SLOT_SIZE * this.zoom, 'btnRecipes', null);
    //     btnRecipes.tooltip = Lang.toggle_recipes;
    //     btnRecipes.setBackground('./media/gui/recipes.png', 'centerstretch', .5)
    //     btnRecipes.onMouseDown = (e) => {
    //         const frmRecipe = this.inventory.player.inventory.recipes.frmRecipe
    //         frmRecipe.assignCraftWindow(this)
    //         frmRecipe.toggleVisibility()
    //     }
    //     ct.add(btnRecipes);
    // }

    /**
     * Создание слотов для крафта
     * @param {int} sz Ширина / высота слота
     */
    createCraft(sz) {
        if(this.craft) {
            console.error('error_inventory_craft_slots_already_created')
            return
        }
        const sx          = 194 * this.zoom
        const sy          = 34 * this.zoom
        const xcnt        = 2
        this.craft = {
            slots: [null, null, null, null]
        };
        for(let i = 0; i < this.craft.slots.length; i++) {
            const lblSlot = new CraftTableRecipeSlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * INVENTORY_SLOT_SIZE * this.zoom, sz, sz, 'lblCraftRecipeSlot' + i, null, null, this, null)
            lblSlot.onMouseEnter = function() {
                this.style.background.color = '#ffffff33'
            }
            lblSlot.onMouseLeave = function() {
                this.style.background.color = '#00000000'
            }
            this.craft.slots[i] = lblSlot
            this.add(lblSlot)
        }
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