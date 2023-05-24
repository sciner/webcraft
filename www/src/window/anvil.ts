import { ItemHelpers } from "../block_helpers.js";
import { Label, TextEdit } from "../ui/wm.js";
import {BAG_LINE_COUNT, INVENTORY_CRAFT_INDEX_MIN, ITEM_LABEL_MAX_LENGTH, UI_THEME} from "../constant.js";
import {AnvilRecipeManager, TAnvilRecipe, TUsedAnvilRecipe} from "../recipes_anvil.js";
import {TableSlot, BaseCraftWindow, TableDataSlot} from "./base_craft_window.js";
import { BLOCK } from "../blocks.js";
import { Lang } from "../lang.js";
import type { PlayerInventory } from "../player_inventory.js";
import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH } from "../constant.js";
import type {TInventoryStateChangeParams} from "../inventory.js";
import type {TMouseEvent} from "../vendors/wm/wm.js";

export class AnvilResultSlot extends TableSlot {

    declare ct: AnvilWindow

    onMouseDown(e : TMouseEvent) {
        const item = this.item
        if (!item) {
            return
        }
        this.ct.useRecipe()
        this.getInventory().setDragItem(this, item)
        this.setItem(null)
        this.ct.onInventoryChange('AnvilResultSlot onMouseDown')
    }

    onDrop(e: TMouseEvent) {
        // ничего
    }

}

//
export class AnvilWindow extends BaseCraftWindow {

    lbl_edit                    : TextEdit
    first_slot                  : TableDataSlot
    second_slot                 : TableDataSlot
    oldFirstSlotLabel ?         : string // старая метка предмета из 1-го слота
    recipes                     = new AnvilRecipeManager()
    used_recipes                : TUsedAnvilRecipe[] = []
    current_recipe              : TAnvilRecipe | null = null
    current_recipe_outCount     : [int, int] | null = null
    current_recipe_label?       : string | null

    constructor(inventory : PlayerInventory) {
        
        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmAnvil', null, null, inventory)
        this.w *= this.zoom
        this.h *= this.zoom

        // Ширина / высота слота
        this.cell_size = UI_THEME.window_slot_size * this.zoom
        this.slot_margin = UI_THEME.slot_margin * this.zoom
        this.slots_x = UI_THEME.window_padding * this.zoom
        this.slots_y = 60 * this.zoom

        this.setBackground('./media/gui/form-quest.png')

        // Создание слотов для инвентаря
        const slots_width = (((this.cell_size / this.zoom) + UI_THEME.slot_margin) * BAG_LINE_COUNT) - UI_THEME.slot_margin + UI_THEME.window_padding
        this.createInventorySlots(this.cell_size, (this.w / this.zoom) - slots_width, 60, UI_THEME.window_padding, undefined, true)

        // Создание слотов для крафта
        this.createAnvilCraft(this.cell_size);

        // Редактор названия предмета
        this.createEdit()

        // Add labels to window
        this.addWindowTitle(Lang.repair)

        // Add close button
        this.addCloseButton()

    }

    // Обработчик закрытия формы
    onHide() {
        this.sendInventory({
            used_recipes: this.used_recipes,
            recipe_manager_type: 'anvil'
        })
        this.used_recipes = []
    }

    // Обработчик открытия формы
    onShow(args) {
        this.lbl_edit.text = ''
        super.onShow(args)
    }

    onPaste(str) {
        this.lbl_edit.paste(str)
    }

    private createEdit() {
        this.lbl_edit = new TextEdit(118 * this.zoom, 62.5 * this.zoom, 220 * this.zoom, 32 * this.zoom, 'lbl_edit', null, 'Hello, World!')
        this.lbl_edit.word_wrap          = false
        this.lbl_edit.max_length         = ITEM_LABEL_MAX_LENGTH
        this.lbl_edit.max_lines          = 1
        this.lbl_edit.style.font.color   = '#ffffff'
        this.lbl_edit.style.padding.left = 5 * this.zoom
        this.lbl_edit.style.textAlign.vertical = 'middle'
        this.lbl_edit.onChange = this.updateResult.bind(this)
        this.add(this.lbl_edit)

        // Тексовая метка
        const lbl = new Label(20 * this.zoom, this.lbl_edit.y + 10, 100 * this.zoom, 30 * this.zoom, 'lblName', null, Lang['item_name'])
        lbl.style.font.color = UI_THEME.label_text_color
        this.add(lbl)
    }

    private createAnvilCraft(cell_size: number) {
        const y = 91 + 27.5
        this.first_slot = new TableDataSlot(52 * this.zoom, y * this.zoom, cell_size, cell_size, 'lblAnvilFirstSlot', null, null, this, INVENTORY_CRAFT_INDEX_MIN);
        this.second_slot = new TableDataSlot(158 * this.zoom, y * this.zoom, cell_size, cell_size, 'lblAnvilSecondSlot', null, null, this, INVENTORY_CRAFT_INDEX_MIN + 1);
        this.lblResultSlot = new AnvilResultSlot(266 * this.zoom, y * this.zoom, cell_size, cell_size, 'lblAnvilResultSlot', null, null, this, null);
        this.add(this.first_slot);
        this.add(this.second_slot);
        this.add(this.lblResultSlot);
        this.craft = {
            slots: [this.first_slot, this.second_slot]
        };

        // Добавить текстовые метки к слотам
        const sy = y - 15
        const lblPlus  = new Label(107 * this.zoom, sy * this.zoom, 20 * this.zoom, 30 * this.zoom, 'lblPlus', null, '+')
        const lblEqual = new Label(215 * this.zoom, sy * this.zoom, 20 * this.zoom, 30 * this.zoom, 'lblEqual', null, '=')
        for(let lbl of [lblPlus, lblEqual]) {
            lbl.style.font.color = UI_THEME.label_text_color
            lbl.style.font.size = 48
            this.add(lbl)
        }
    }

    updateResult() {
        const first_item = this.first_slot.getItem()
        if(!first_item) {
            if(this.lbl_edit.text != '') {
                this.lbl_edit.text = ''
            }
            this.lblResultSlot.setItem(null)
            return
        }
        const second_item = this.second_slot.getItem()
        let label: string | null = this.lbl_edit.text
        if (label === ItemHelpers.getLabel(first_item)) {
            // If it's the same, don't try to change, and don't validate it, so unchanged block titles
            // longer than ITEM_LABEL_MAX_LENGTH don't get rejected.
            label = ItemHelpers.LABEL_NO_CHANGE;
        } else if (label === BLOCK.fromId(first_item.id).title) {
            // If it's the same as the title, clear the label instead.
            // It must be checked here, not in the recipes, because it depeends on the user's locale.
            label = null;
        }
        const outCount: [int, int] = [0, 0]
        const found = this.recipes.findRecipeAndResult(first_item, second_item, label, outCount);
        this.lblResultSlot.setItem(found?.result);
        if (found) {
            this.current_recipe = found.recipe;
            this.current_recipe_outCount = outCount;
            this.current_recipe_label = label;
        }
    }

    useRecipe(): void {
        const count = this.current_recipe_outCount;
        // here we decrement or clear the ingredients slots
        const used_items_keys = this.getUsedItemsKeysAndDecrement(count);
        this.used_recipes.push({
            recipe_id: this.current_recipe.id,
            used_items_keys,
            count,
            label: this.current_recipe_label
        });
    }

    sendInventory(params: TInventoryStateChangeParams): void {
        params.used_recipes = this.used_recipes
        params.recipe_manager_type = 'anvil'
        this.used_recipes = []
        super.sendInventory(params)
    }

    onInventoryChange(context?: string): void {
        this.updateResult()

        // Если в первый слот положили непустой предмет, и его метка отличается от той,
        // что была раньше в этом слоте - сбросить редактируемый текст
        const item = this.first_slot.item
        if (item) {
            const newLabel = ItemHelpers.getLabel(item);
            if (this.oldFirstSlotLabel !== newLabel) {
                this.oldFirstSlotLabel = newLabel
                this.lbl_edit.text = newLabel
            }
        }

        super.onInventoryChange(context)
    }
}