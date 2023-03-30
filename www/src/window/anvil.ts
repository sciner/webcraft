import { ItemHelpers } from "../block_helpers.js";
import { Label, TextEdit } from "../ui/wm.js";
import { ITEM_LABEL_MAX_LENGTH, UI_THEME } from "../constant.js";
import { AnvilRecipeManager } from "../recipes_anvil.js";
import { CraftTableSlot, BaseCraftWindow } from "./base_craft_window.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";
import { BLOCK } from "../blocks.js";
import { Lang } from "../lang.js";
import { Resources } from "../resources.js";
import type { PlayerInventory } from "../player_inventory.js";

//
class AnvilSlot extends CraftTableSlot {
    [key: string]: any;

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
        if (this == ct.result_slot) {
            ct.useRecipe();
        }
        this.getInventory().setDragItem(this, dragItem, e.drag, this.w, this.h)
        this.setItem(null)
        ct.updateResult()
    }

    onDrop(e : any) {
        const ct = this.ct
        if (this == ct.result_slot) {
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

    getInventory() {
        return this.ct.inventory
    }

}

//
export class AnvilWindow extends BaseCraftWindow {

    constructor(inventory : PlayerInventory) {

        const w = 420
        const h = 400

        super(0, 0, w, h, 'frmAnvil', null, null, inventory)
        this.w *= this.zoom
        this.h *= this.zoom

        this.recipes = new AnvilRecipeManager()
        this.used_recipes = []
        this.current_recipe = null
        this.current_recipe_outCount = null

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/anvil.png').then(async (atlas : SpriteAtlas) => {

            this.setBackground(await atlas.getSprite(0, 0, w * 2, h * 2), 'stretch', this.zoom / 2.0)

            // Ширина / высота слота
            this.cell_size     = UI_THEME.window_slot_size * this.zoom
            this.slot_margin   = UI_THEME.slot_margin * this.zoom
            this.slots_x       = UI_THEME.window_padding * this.zoom
            this.slots_y       = 62 * this.zoom
        
            const szm = this.cell_size + this.slot_margin
            const inventory_y = this.h - szm * 4 - (UI_THEME.window_padding * this.zoom)

             // Создание слотов для инвентаря
            this.createInventorySlots(this.cell_size, undefined, inventory_y / this.zoom)

            // Создание слотов для крафта
            this.createCraft(this.cell_size);

            // Редактор названия предмета
            this.createEdit()

            // Add labels to window
            this.addWindowTitle(Lang.repair)

            // Add close button
            this.addCloseButton()

        })

    }

    // Обработчик закрытия формы
    onHide() {
        this.clearCraft()
        // Save inventory
        Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), this.used_recipes, 'anvil')
        this.used_recipes = []
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

    async createEdit() {
        this.lbl_edit = new TextEdit(118 * this.zoom, 62.5 * this.zoom, 220 * this.zoom, 32 * this.zoom, 'lbl_edit', null, 'Hello, World!')
        this.lbl_edit.word_wrap          = false
        this.lbl_edit.max_length         = ITEM_LABEL_MAX_LENGTH
        this.lbl_edit.max_lines          = 1
        this.lbl_edit.style.font.color   = '#ffffff'
        this.lbl_edit.style.padding.left = 5 * this.zoom
        this.lbl_edit.style.textAlign.vertical = 'middle'
        this.lbl_edit.onChange = this.updateResult.bind(this)
        this.add(this.lbl_edit)
    }

    createCraft(cell_size) {
        this.craft = {
            slots: [null, null]
        };
        const y = 91 + 22.5
        this.first_slot = new AnvilSlot(52 * this.zoom, y * this.zoom, cell_size, cell_size, 'lblAnvilFirstSlot', null, null, this);
        this.second_slot = new AnvilSlot(150 * this.zoom, y * this.zoom, cell_size, cell_size, 'lblAnvilSecondSlot', null, null, this);
        this.result_slot = new AnvilSlot(266 * this.zoom, y * this.zoom, cell_size, cell_size, 'lblAnvilResultSlot', null, null, this);
        this.add(this.craft.slots[0] = this.first_slot);
        this.add(this.craft.slots[1] = this.second_slot);
        this.add(this.lblResultSlot = this.result_slot);
    }

    updateResult() {
        const first_item = this.first_slot.getItem()
        if(!first_item) {
            if(this.lbl_edit.text != '') {
                this.lbl_edit.text = ''
            }
            this.result_slot.setItem(null)
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
        const outCount = [];
        const found = this.recipes.findRecipeAndResult(first_item, second_item, label, outCount);
        this.result_slot.setItem(found?.result);
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