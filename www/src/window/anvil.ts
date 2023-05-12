import { ItemHelpers } from "../block_helpers.js";
import { Label, TextEdit } from "../ui/wm.js";
import { BAG_LINE_COUNT, ITEM_LABEL_MAX_LENGTH, UI_THEME } from "../constant.js";
import {AnvilRecipeManager, TAnvilRecipe} from "../recipes_anvil.js";
import {CraftTableSlot, BaseCraftWindow, TCraftTableSlotContext} from "./base_craft_window.js";
import { BLOCK } from "../blocks.js";
import { Lang } from "../lang.js";
import type { PlayerInventory } from "../player_inventory.js";
import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH } from "../constant.js";

//
export class AnvilSlot extends CraftTableSlot {

    declare ct: AnvilWindow

    constructor(x, y, w, h, id, title, text, ct) {
        super(x, y, w, h, id, title, text, ct, null)
        this.ct = ct
        this.refresh()
    }

    onMouseDown(e : any) {
        const ct = this.ct
        const dragItem = this.getItem()
        if (!dragItem) {
            return
        }
        if (this == ct.lblResultSlot) {
            ct.useRecipe();
        }
        this.getInventory().setDragItem(this, dragItem, e.drag, this.w, this.h)
        this.setItem(null)
        ct.updateResult()
    }

    onDrop(e : any) {
        const ct = this.ct
        if (this == ct.lblResultSlot) {
            return;
        }
        const oldItem = this.getItem();
        if(!this.dropIncrementOrSwap(e, oldItem)) {
            return
        }
        // Если это первый слот
        if (this == ct.first_slot) {
            const oldCurrentLabel = oldItem && ItemHelpers.getLabel(oldItem);
            const newCurrentLabel = ItemHelpers.getLabel(this.getItem());
            if (oldCurrentLabel !== newCurrentLabel) {
                ct.lbl_edit.text = newCurrentLabel
            }
        }
        ct.updateResult();
    }

}

//
export class AnvilWindow extends BaseCraftWindow {

    lbl_edit                    : TextEdit
    first_slot                  : AnvilSlot
    second_slot                 : AnvilSlot
    recipes                     = new AnvilRecipeManager()
    used_recipes : {
        recipe_id       : string
        used_items_keys : string[]
        count           : [int, int]
        label           : string
    }[] = []
    current_recipe              : TAnvilRecipe | null = null
    current_recipe_outCount     : [int, int] | null = null
    current_recipe_label?       : string

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
        this.createCraft(this.cell_size);

        // Редактор названия предмета
        this.createEdit()

        // Add labels to window
        this.addWindowTitle(Lang.repair)

        // Add close button
        this.addCloseButton()

    }

    // Обработчик закрытия формы
    onHide() {
        this.inventory.sendStateChange({
            used_recipes: this.used_recipes,
            recipe_manager_type: 'anvil',
            thrown_items: this.clearCraft()
        })
        this.used_recipes = []
        this.refresh()
    }

    // Обработчик открытия формы
    onShow(args) {
        this.lbl_edit.text = ''
        Qubatch.releaseMousePointer()
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

    private createCraft(cell_size: number) {
        const y = 91 + 27.5
        this.first_slot = new AnvilSlot(52 * this.zoom, y * this.zoom, cell_size, cell_size, 'lblAnvilFirstSlot', null, null, this);
        this.second_slot = new AnvilSlot(158 * this.zoom, y * this.zoom, cell_size, cell_size, 'lblAnvilSecondSlot', null, null, this);
        this.lblResultSlot = new AnvilSlot(266 * this.zoom, y * this.zoom, cell_size, cell_size, 'lblAnvilResultSlot', null, null, this);
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
        let label = this.lbl_edit.text
        if (label === ItemHelpers.getLabel(first_item)) {
            // If it's the same, don't try to change, and don't validate it, so unchanged block titles
            // longer than ITEM_LABEL_MAX_LENGTH don't get rejected.
            label = false;
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

    useRecipe() {
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

}