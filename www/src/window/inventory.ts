import { Label, Window } from "../ui/wm.js";
import { BaseCraftWindow, CraftTableRecipeSlot } from "./base_craft_window.js";
import { Lang } from "../lang.js";
import { INVENTORY_HOTBAR_SLOT_COUNT, UI_THEME } from "../constant.js";
import { skinview3d } from "../../vendors/skinview3d.bundle.js"
import { blobToImage } from "../helpers.js";
import type { InventoryRecipeWindow } from "./inventory_recipe.js";
import type { PlayerInventory } from "../player_inventory.js";
import type { InGameMain } from "./ingamemain.js";
import { Resources } from "../resources.js";
import type { SpriteAtlas } from "../core/sprite_atlas.js";
import type {RecipeManager} from "../recipes.js";

export class InventoryWindow extends BaseCraftWindow {

    frmInventoryRecipe : InventoryRecipeWindow
    recipes: RecipeManager

    slot_empty = 'slot_empty'
    slot_full = 'slot_full'
    cell_size : float
    slot_margin : float
    slots_x : float
    slots_y : float
    hud_atlas : SpriteAtlas

    constructor(inventory: PlayerInventory, recipes: RecipeManager) {

        super(0, 0, 700, 332, 'frmInventory', null, null, inventory)
        this.w *= this.zoom
        this.h *= this.zoom
        this.recipes = recipes

        this.skinKey = null
        this.skinViewer = null // lazy initialized if necessary

        // Ширина / высота слота
        this.cell_size     = UI_THEME.window_slot_size * this.zoom
        this.slot_margin   = UI_THEME.window_padding * this.zoom
        this.slots_x       = UI_THEME.window_padding * this.zoom
        this.slots_y       = 62 * this.zoom;

        // Craft area
        this.area = {
            size: {
                width: 2,
                height: 2
            }
        };

    }

    initControls(parent : InGameMain) {

        this.hud_atlas = Resources.atlas.get('hud')

        const sz          = this.cell_size
        const szm         = sz + UI_THEME.slot_margin * this.zoom
        const sx          = UI_THEME.window_padding * this.zoom * 3.5 + szm
        const sy          = 34 * this.zoom

        // слоты для подсказок
        this.addHelpSlots(sx, sy, sz, szm)

        // Создание слотов для крафта
        this.createCraft(sx, sy, sz, szm)

        // Calc backpack slots width
        const slots_width = (((this.cell_size / this.zoom) + UI_THEME.slot_margin) * INVENTORY_HOTBAR_SLOT_COUNT) - UI_THEME.slot_margin + UI_THEME.window_padding

        // Создание слотов для инвентаря
        const x = this.w / this.zoom - slots_width
        const y = 35
        this.createInventorySlots(this.cell_size, x, y, UI_THEME.window_padding, undefined, true)

        // Итоговый слот (то, что мы получим)
        this.createResultSlot(UI_THEME.window_padding * this.zoom * 3.5 + szm * 4, 34 * this.zoom + sz * .5)

        const result_arrow = new Window(UI_THEME.window_padding * this.zoom * 3.5 + szm * 3, 34 * this.zoom + sz * .5, sz, sz, 'resultArrow')
        this.add(result_arrow)
        result_arrow.setIcon(this.hud_atlas.getSpriteFromMap('arrow_next_locked'), 'stretchcenter', .25)

        const lblBackpackWidth = (slots_width - UI_THEME.window_padding) * this.zoom

        const labels = [
            new Label(x * this.zoom, UI_THEME.window_padding * this.zoom, lblBackpackWidth, 30 * this.zoom, 'lblBackpack', null, Lang.backpack),
            new Label(UI_THEME.window_padding * this.zoom * 3.5 + szm, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lblTitle', null, Lang.craft),
        ]

        for(let lbl of labels) {
            lbl.style.font.color = UI_THEME.label_text_color
            lbl.style.font.size = UI_THEME.base_font.size
            this.add(lbl)
        }

    }

    // Обработчик открытия формы
    onShow(args) {

        if(!this.frmInventoryRecipe) {
            const form = this.inventory.player.inventory.recipes.frmInventoryRecipe
            form.style.background.image = null
            form.parent.delete(form.id)
            form.x = UI_THEME.window_padding * this.zoom
            form.y = 95 * this.zoom
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

        const thrown_items = this.clearCraft()

        // // Update player mob model
        // this.inventory.player.updateArmor()

        // Save inventory
        this.world.server.InventoryNewState({
            state: this.inventory.exportItems(),
            used_recipes: this.lblResultSlot.getUsedRecipes(),
            thrown_items
        })

//        this.skinViewer.renderPaused = true
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
     */
    createCraft(sx : float, sy : float, sz : float, szm : float) {

        if(this.craft) {
            console.error('error_inventory_craft_slots_already_created')
            return
        }

        const xcnt = 2

        this.craft = {
            slots: [null, null, null, null]
        }

        for(let i = 0; i < this.craft.slots.length; i++) {
            const x = sx + (i % xcnt) * szm
            const y = sy + Math.floor(i / xcnt) * szm
            const lblSlot = new CraftTableRecipeSlot(x, y, sz, sz, 'lblCraftRecipeSlot' + i, null, null, this, null)
            this.craft.slots[i] = lblSlot
            this.add(lblSlot)
        }

        const locked_slots = [
            // {x: sx - szm, y: sy},
            // {x: sx - szm, y: sy + szm},
            // {x: sx + szm * 2, y: sy},
            // {x: sx + szm * 2, y: sy + szm},
        ]

        for(let i = 0; i < locked_slots.length; i++) {
            const ls = locked_slots[i]
            const lbl = new Label(ls.x, ls.y, sz, sz, `lblLocked_${i}`)
            lbl.setBackground(this.hud_atlas.getSpriteFromMap('window_slot_locked'))
            this.add(lbl)
        }

    }

}