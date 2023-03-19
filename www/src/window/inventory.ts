import { Button, Label } from "../ui/wm.js";
import { ArmorSlot, BaseCraftWindow, CraftTableRecipeSlot } from "./base_craft_window.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE, UI_THEME } from "../constant.js";
import { skinview3d } from "../../vendors/skinview3d.bundle.js"
// import { SpriteAtlas } from "../core/sprite_atlas.js";
import { blobToImage } from "../helpers.js";
import type { RecipeWindow } from "./recipe.js";
import type { InventoryRecipeWindow } from "./inventory_recipe.js";
import type { PlayerInventory } from "../player_inventory.js";
import type { InGameMain } from "./ingamemain.js";

export class InventoryWindow extends BaseCraftWindow {

    frmInventoryRecipe : InventoryRecipeWindow

    slot_empty = 'slot_empty'
    slot_full = 'slot_full'

    constructor(inventory : PlayerInventory, recipes) {

        super(10, 10, 700, 332, 'frmInventory', null, null, inventory)
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom
        this.recipes = recipes

        this.skinKey = null
        this.skinViewer = null // lazy initialized if necessary

        // Craft area
        this.area = {
            size: {
                width: 2,
                height: 2
            }
        };

    }

    initControls(parent : InGameMain) {

        // слоты для подсказок
        this.addHelpSlots()

        // Ширина / высота слота
        this.cell_size = UI_THEME.window_slot_size * this.zoom // INVENTORY_SLOT_SIZE

        // Создание слотов для крафта
        this.createCraft(this.cell_size)

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size)

        // Итоговый слот (то, что мы получим)
        this.createResultSlot(306 * this.zoom, 54 * this.zoom)

        // Add labels to window
        const lblTitle = new Label(194 * this.zoom, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lblTitle', null, Lang.create)
        lblTitle.style.font.color = UI_THEME.base_text_color
        this.add(lblTitle)

    }

    // Обработчик открытия формы
    onShow(args) {

        if(!this.frmInventoryRecipe) {
            const form = this.inventory.player.inventory.recipes.frmInventoryRecipe
            form.style.background.image = null
            form.parent.delete(form.id)
            form.x = 370 * this.zoom
            form.y = 0 * this.zoom
            this.frmInventoryRecipe = form
            this.add(form)
        }

        // this.previewSkin()
        this.setHelperSlots(null)
        super.onShow(args)

        this.frmInventoryRecipe.assignCraftWindow(this)
        this.frmInventoryRecipe.show()

    }

    // Обработчик закрытия формы
    onHide() {
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

        // Save inventory
        Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), this.lblResultSlot.getUsedRecipes())

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

}