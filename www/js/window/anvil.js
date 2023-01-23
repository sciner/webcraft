import { ITEM_LABEL_MAX_LENGTH } from "../blocks.js";
import { ItemHelpers } from "../block_helpers.js";
import { Button, Label, TextEdit } from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { AnvilRecipeManager } from "../recipes_anvil.js";
import { CraftTableSlot, BaseCraftWindow } from "./base_craft_window.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";

//
class AnvilSlot extends CraftTableSlot {
    constructor(x, y, w, h, id, title, text, ct) {
        super(x, y, w, h, id, title, text, ct, null);
        
        this.ct = ct;

        this.onMouseEnter = function() {
            this.style.background.color = '#ffffff55';
        };

        this.onMouseLeave = function() {
            this.style.background.color = '#00000000';
        };
        
        this.onMouseDown = function(e) { 
            const dragItem = this.getItem();
            if (!dragItem) {
                return;
            }
            if (this == ct.result_slot) {
                ct.useRecipe();
            }
            this.getInventory().setDragItem(this, dragItem, e.drag, this.w, this.h)
            this.setItem(null)
            ct.updateResult()
        };
        
        this.onDrop = function(e) {
            if (this == ct.result_slot) {
                return;
            }
            const oldItem = this.getItem();
            this.dropIncrementOrSwap(e, oldItem);
            // Если это первый слот
            if (this == ct.first_slot) {
                const oldCurrentLabel = oldItem && ItemHelpers.getLabel(oldItem);
                const newCurrentLabel = ItemHelpers.getLabel(this.getItem());
                if (oldCurrentLabel !== newCurrentLabel) {
                    ct.lbl_edit.text = newCurrentLabel
                }
            }
            ct.updateResult();
        };
    }
    
    getInventory() {
        return this.ct.inventory;
    }

}

//
export class AnvilWindow extends BaseCraftWindow {

    constructor(inventory) {
        
        super(10, 10, 350, 330, 'frmAnvil', null, null, inventory);
        
        this.w *= this.zoom;
        this.h *= this.zoom;
        this.style.background.image_size_mode = 'stretch';

        this.recipes = new AnvilRecipeManager();
        this.used_recipes = [];
        this.current_recipe = null;
        this.current_recipe_outCount = null;

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/anvil.png').then(async atlas => {
            this.setBackground(await atlas.getSprite(0, 0, 352 * 2, 332 * 2), 'none', this.zoom / 2.0)
        })

        // Add labels to window
        this.add(new Label(110 * this.zoom, 12 * this.zoom, 150 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Repair & Name'))

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom
        
         // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size)

        // Создание слотов для крафта
        this.createCraft(this.cell_size);

        // Редактор названия предмета
        this.createEdit()

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const that = this
            // Close button
            const btnClose = new Button(that.w - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial'
            btnClose.style.background.image = image
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                that.hide()
            }
            that.add(btnClose)
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
    onShow() {
        this.lbl_edit.text = ''
        Qubatch.releaseMousePointer()
    }

    onPaste(str) {
        this.lbl_edit.paste(str)
    }
    
    createEdit() {
        
        const options = {
            background: {
                image: './media/gui/anvil.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 333 * 2,
                    width: 220 * 2,
                    height: 31 * 2
                }
            }
        };
        this.lbl_edit = new TextEdit(118 * this.zoom, 40 * this.zoom, 220 * this.zoom, 32 * this.zoom, 'lbl_edit', null, 'Hello, World!');
        // this.lbl_edit = new TextBox(this.zoom);
        this.lbl_edit.word_wrap         = false;
        this.lbl_edit.focused           = true;
        this.lbl_edit.max_length        = ITEM_LABEL_MAX_LENGTH;
        this.lbl_edit.max_lines         = 1;
        this.lbl_edit.style.color       = '#ffffff';
        this.lbl_edit.style.font.size   *= 1.1;
        this.lbl_edit.style.background  = options.background;
        this.lbl_edit.setBackground(options.background.image);
        this.lbl_edit.onChange = () => this.updateResult();
        this.add(this.lbl_edit);
        
    }

    createCraft(cell_size) {
        this.craft = {
            slots: [null, null]
        };
        this.first_slot = new AnvilSlot(52 * this.zoom, 91 * this.zoom, cell_size, cell_size, 'lblAnvilFirstSlot', null, null, this);
        this.second_slot = new AnvilSlot(150 * this.zoom, 91 * this.zoom, cell_size, cell_size, 'lblAnvilSecondSlot', null, null, this);
        this.result_slot = new AnvilSlot(266 * this.zoom, 91 * this.zoom, cell_size, cell_size, 'lblAnvilResultSlot', null, null, this);
        this.add(this.craft.slots[0] = this.first_slot);
        this.add(this.craft.slots[1] = this.second_slot);
        this.add(this.lblResultSlot = this.result_slot);
    }

    updateResult() {
        const first_item = this.first_slot.getItem();
        if (!first_item) {
            this.lbl_edit.text = ''
            this.result_slot.setItem(null);
            return;
        }
        const second_item = this.second_slot.getItem();
        let label = this.lbl_edit.text;
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
    
    draw(ctx, ax, ay) {
        super.draw(ctx, ax, ay);
        if(this.result_slot.getItem() == null) {
            if(typeof this.style.background.image == 'object') {
                const x = ax + this.x;
                const y = ay + this.y;
                const arrow = {x: 704, y: 0, width: 112, height: 80, tox: 198 * this.zoom, toy: 88 * this.zoom};
                ctx.drawImage(
                    this.style.background.image,
                    arrow.x,
                    arrow.y,
                    arrow.width,
                    arrow.height,
                    x + arrow.tox,
                    y + arrow.toy,
                    arrow.width * this.zoom / 2,
                    arrow.height * this.zoom / 2
                );
            }
        }
        
    }
    
}