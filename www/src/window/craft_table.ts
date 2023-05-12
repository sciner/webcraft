import { Label, Window } from "../ui/wm.js";
import { BaseCraftWindow, CraftTableRecipeSlot } from "./base_craft_window.js";
import { BAG_LINE_COUNT, INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH, INVENTORY_SLOT_SIZE, UI_THEME } from "../constant.js";
import type { SpriteAtlas } from "../core/sprite_atlas.js";
import { Lang } from "../lang.js";
import type {PlayerInventory} from "../player_inventory.js";
import type { RecipeManager } from "../recipes.js";
import type { RecipeWindow } from "./recipe.js";
import { Resources } from "../resources.js";

const SHIFT_Y = 15

// CraftTable
export class CraftTable extends BaseCraftWindow {

    frmRecipe : RecipeWindow
    hud_atlas : SpriteAtlas

    constructor(inventory : PlayerInventory, recipes : RecipeManager) {

        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmCraft', null, null, inventory)
        this.w *= this.zoom
        this.h *= this.zoom

        this.setBackground('./media/gui/form-quest.png')

        this.hud_atlas = Resources.atlas.get('hud')
        this.recipes = recipes

        // Craft area
        this.area = {
            size: {
                width: 3,
                height: 3
            }
        }

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom

        // Ширина / высота слота
        this.cell_size      = UI_THEME.window_slot_size * this.zoom
        this.slot_margin    = UI_THEME.window_padding * this.zoom
        this.slots_x        = UI_THEME.window_padding * this.zoom
        this.slots_y        = 62 * this.zoom;

        const sz            = this.cell_size
        const szm           = sz + UI_THEME.slot_margin * this.zoom
        const sx            = UI_THEME.window_padding * this.zoom * 3.5 + szm
        const sy            = (34 + SHIFT_Y) * this.zoom

        // слоты (лабел) для подсказок
        this.addHelpSlots(sx, sy, sz, szm)

        // Создание слотов для крафта
        this.createCraft(sx - szm, sy, sz, szm)

        // Calc backpack slots width
        const slots_width = (((this.cell_size / this.zoom) + UI_THEME.slot_margin) * BAG_LINE_COUNT) - UI_THEME.slot_margin + UI_THEME.window_padding

        // Создание слотов для инвентаря
        const x = this.w / this.zoom - slots_width
        const y = 35 + SHIFT_Y
        this.createInventorySlots(this.cell_size, x, y, UI_THEME.window_padding)

        // Итоговый слот (то, что мы получим)
        this.createResultSlot(UI_THEME.window_padding * this.zoom * 3.5 + szm * 4, (34 + SHIFT_Y) * this.zoom + szm)

        const result_arrow = new Window(UI_THEME.window_padding * this.zoom * 3.5 + szm * 3, (34 + SHIFT_Y) * this.zoom + szm, sz, sz, 'resultArrow')
        this.add(result_arrow)
        result_arrow.setIcon(this.hud_atlas.getSpriteFromMap('arrow_next_locked'), 'stretchcenter', .25)

        const lblBackpackWidth = (slots_width - UI_THEME.window_padding) * this.zoom

        const labels = [
            // new Label(UI_THEME.window_padding * this.zoom * 3.5, (UI_THEME.window_padding + SHIFT_Y) * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lblTitle', null, Lang.crafting_table),
            new Label(UI_THEME.window_padding * this.zoom * 3.5, (UI_THEME.window_padding + SHIFT_Y) * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lblTitle', null, Lang.craft),
            new Label(x * this.zoom, (UI_THEME.window_padding + SHIFT_Y) * this.zoom, lblBackpackWidth, 30 * this.zoom, 'lblBackpack', null, Lang.backpack),
        ]

        for(let lbl of labels) {
            lbl.style.font.color = UI_THEME.label_text_color
            lbl.style.font.size = UI_THEME.base_font.size
            this.add(lbl)
        }

        // Add close button
        this.addCloseButton()

    }

    // onShow
    onShow(args : any) {

        if(!this.frmRecipe) {
            const form = this.inventory.player.inventory.recipes.frmRecipe
            form.style.background.image = null
            form.parent.delete(form.id)
            form.x = UI_THEME.window_padding * this.zoom
            form.y = (140 + SHIFT_Y) * this.zoom
            this.frmRecipe = form
            this.add(form)
        }

        this.frmRecipe.ignore_esc = true
        this.frmRecipe.assignCraftWindow(this)
        this.frmRecipe.show()

        // this.inventory.player.inventory.recipes.frmRecipe.visible = false
        Qubatch.releaseMousePointer()
        this.setHelperSlots(null)
        super.onShow(args)

    }

    // Обработчик закрытия формы
    onHide() {
        this.inventory.sendStateChange({
            thrown_items: this.clearCraft(),
            used_recipes: this.lblResultSlot.getUsedRecipes()
        })
        super.onHide()
    }

    /**
    * Создание слотов для крафта
    */
    createCraft(sx : float, sy : float, sz : float, szm : float) {

        const ct = this

        if(this.craft) {
            console.error('error_inventory_craft_slots_already_created')
            return
        }

        const xcnt = 3

        this.craft = {
            slots: [null, null, null, null, null, null, null, null, null]
        }

        for(let i = 0; i < ct.craft.slots.length; i++) {
            const x = sx + (i % xcnt) * szm
            const y = sy + Math.floor(i / xcnt) * szm
            const options = {
                onMouseEnterBackroundColor: '#ffffff33'
            }
            let lblSlot = new CraftTableRecipeSlot(x, y, sz, sz, 'lblCraftRecipeSlot' + i, null, '' + i, this, null, options)
            lblSlot.is_craft_slot = true
            ct.add(this.craft.slots[i] = lblSlot)
        }

    }

}