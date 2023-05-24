import { Label, Window } from "../ui/wm.js";
import { BaseCraftWindow } from "./base_craft_window.js";
import { Lang } from "../lang.js";
import { BAG_LINE_COUNT, UI_THEME } from "../constant.js";
import type { InventoryRecipeWindow } from "./inventory_recipe.js";
import type { PlayerInventory } from "../player_inventory.js";
import type { InGameMain } from "./ingamemain.js";
import { Resources } from "../resources.js";
import type { SpriteAtlas } from "../core/sprite_atlas.js";
import type {RecipeManager} from "../recipes.js";
import type {TInventoryStateChangeParams} from "../inventory.js";

export class InventoryWindow extends BaseCraftWindow {

    frmInventoryRecipe : InventoryRecipeWindow
    recipes: RecipeManager

    slot_empty = 'slot_empty'
    slot_full = 'slot_full'
    hud_atlas : SpriteAtlas

    constructor(inventory: PlayerInventory, recipes: RecipeManager) {

        super(0, 0, 700, 332, 'frmInventory', null, null, inventory)
        this.w *= this.zoom
        this.h *= this.zoom
        this.recipes = recipes

        // Ширина / высота слота
        this.cell_size     = UI_THEME.window_slot_size * this.zoom
        this.slot_margin   = UI_THEME.window_padding * this.zoom
        this.slots_x       = UI_THEME.window_padding * this.zoom
        this.slots_y       = 62 * this.zoom;

        this.craft_area = {
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
        this.createCraft(sx, sy, sz, szm, 2, 2)

        // Calc backpack slots width
        const slots_width = (((this.cell_size / this.zoom) + UI_THEME.slot_margin) * BAG_LINE_COUNT) - UI_THEME.slot_margin + UI_THEME.window_padding

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

        // кнопка сортировки
        //this.createButtonSort()

        // слот для удаления преметов
        this.createDeleteSlot(this.cell_size)
    }

    // Обработчик открытия формы
    onShow(args) {

        if(!this.frmInventoryRecipe) {
            const form = this.inventory.player.windows.frmInventoryRecipe
            form.style.background.image = null
            form.untypedParent.delete(form.id)
            form.x = UI_THEME.window_padding * this.zoom
            form.y = 95 * this.zoom
            this.frmInventoryRecipe = form
            this.add(form)
        }

        this.setHelperSlots(null)
        super.onShow(args)

        this.frmInventoryRecipe.assignCraftWindow(this)
        this.frmInventoryRecipe.show()

    }

    sendInventory(params: TInventoryStateChangeParams): void {
        params.used_recipes = this.lblResultSlot.getUsedRecipes()
        super.sendInventory(params)
    }

}