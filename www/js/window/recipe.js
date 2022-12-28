import {BLOCK} from "../blocks.js";
import {Button, Label, Window} from "../../tools/gui/wm.js";
import {Resources} from "../resources.js";
import { INVENTORY_ICON_COUNT_PER_TEX } from "../chunk_const.js";

class FakeSlot extends Label {

    constructor(x, y, w, h, id, title, text, ct, slot_index) {
        super(x, y, w, h, id, null, null);
        this.ct = ct;
        this.setSlotIndex(slot_index);
    }

    //
    get tooltip() {
       /* let resp = null;
        let item = this.getItem();
        if(item) {
            if(item.id) {
                const block = BLOCK.fromId(item.id);
                if(block) {
                    resp = block.name.replaceAll('_', ' ') + ` (#${item.id})`;
                }
            } else {

            }
        }
        return resp;
        */
    }

    getIndex() {
        return this.slot_index !== null ? this.slot_index : parseFloat(this.index);
    }

    // Draw slot
    draw(ctx, ax, ay) {
        this.applyStyle(ctx, ax, ay);
       // let item = this.getItem();
        //
        //if(DRAW_SLOT_INDEX) {
            ctx.fillStyle = '#00000022';
            ctx.font = '32px Ubuntu';
            ctx.fillText(this.slot_index || '', ax + this.x + 4, ay + this.y + 4);
        //}
        //
        this.drawItem(ctx, {id:32}, ax + this.x, ay + this.y, this.width, this.height);
        super.draw(ctx, ax, ay);
    }

    // Draw item
    drawItem(ctx, item, x, y, width, height) {
        
        const image = Qubatch.player.inventory.inventory_image;

        if(!image || !item) {
            return;
        }

        const size = image.width;
        const frame = size / INVENTORY_ICON_COUNT_PER_TEX;
        const zoom = this.zoom;
        const mat = BLOCK.fromId(item.id);

        ctx.imageSmoothingEnabled = true;

        // 1. Draw icon
        const icon = BLOCK.getInventoryIconPos(mat.inventory_icon_id, size, frame);
        const dest_icon_size = 40 * zoom;
        ctx.drawImage(
            image,
            icon.x,
            icon.y,
            icon.width,
            icon.height,
            x + width / 2 - dest_icon_size / 2,
            y + height / 2 - dest_icon_size / 2,
            dest_icon_size,
            dest_icon_size
        );

        // 2. raw label
        let font_size = 18;
        const power_in_percent = mat?.item?.indicator == 'bar';
        let label = item.count > 1 ? item.count : null;
        let shift_y = 0;
        if(!label && 'power' in item) {
            if(power_in_percent) {
                label = (Math.round((item.power / mat.power * 100) * 100) / 100) + '%';
            } else {
                label = null;
            }
            font_size = 12;
            shift_y = -10;
        }
        if(label) {
            ctx.textBaseline        = 'bottom';
            ctx.textAlign           = 'right';
            ctx.font                = Math.round(font_size * zoom) + 'px ' + UI_FONT;
            ctx.fillStyle           = '#000000ff';
            ctx.fillText(label, x + width + 2 * zoom, y + height + (2 + shift_y) * zoom);
            ctx.fillStyle           = '#ffffffff';
            ctx.fillText(label, x + width, y + height + (shift_y) * zoom);
        }
    }

    setSlotIndex(index) {
        this.slot_index = index;
    }

}

export class RecipeSlot extends Window {

    constructor(x, y, w, h, id, title, text, recipe, block) {
        super(x, y, w, h, id, title, text);
        //
        this.recipe = recipe;
        this.block = block;
        
        //
        this.style.border.color = '#ffffffff';
        this.style.background.color = '#ffffff55';
        // Custom drawing
        this.onMouseEnter = function(e) {
            this.style.background.color = this.can_make ? '#ffffffcc' : '#ff000077';
        }
        this.onMouseLeave = function(e) {
            this.style.background.color = this.can_make ? '#ffffff55' : '#ff000055';
        }
        this.onMouseDown = function(e) {
            console.log(e)
            if(!this.can_make) {
                return;
            }
            
            for(let recipe of [this.recipe, ...this.recipe.subrecipes]) {
                if(this.canMake(recipe)) {
                    this.parent.craft_window.autoRecipe(recipe);
                    this.parent.paginator.update();
                    break;
                }
            }
        };
    }

    canMake(recipe) {
        return Qubatch.player.inventory.hasResources(recipe.need_resources).length == 0;
    }

    update() {
        this.can_make = false;
        for(let recipe of [this.recipe, ...this.recipe.subrecipes]) {
            this.can_make = this.canMake(recipe)
            if(this.can_make) {
                break;
            }
        }
        if(this.can_make) {
            let craft_area_size = this.parent.craft_window.area.size;
            this.can_make = this.recipe.size.width <= craft_area_size.width &&
                            this.recipe.size.height <= craft_area_size.height;
        }
        this.style.background.color = this.can_make ? '#ffffff55' : '#ff000055';
    }

    draw(ctx, ax, ay) {
        this.applyStyle(ctx, ax, ay);
        super.draw(ctx, ax, ay);
        const item = this.block;
        this.drawItem(ctx, item, ax + this.x, ay + this.y, this.width, this.height);
    }

    drawItem(ctx, item, x, y, width, height) {

        const inventory_image = Resources.inventory.image;

        if(!inventory_image || !item) {
            return;
        }

        const size = inventory_image.width;
        const frame = size / INVENTORY_ICON_COUNT_PER_TEX;

        ctx.imageSmoothingEnabled = false;

        // 
        if('inventory_icon_id' in item) {
            let icon = BLOCK.getInventoryIconPos(item.inventory_icon_id, size, frame);
            const dest_icon_size = 32 * this.zoom;
            ctx.drawImage(
                inventory_image,
                icon.x,
                icon.y,
                icon.width,
                icon.height,
                x + width / 2 - dest_icon_size / 2,
                y + height / 2 - dest_icon_size / 2,
                dest_icon_size,
                dest_icon_size
            );
        }
    }

}

// RecipeWindow...
export class RecipeWindow extends Window {

    constructor(recipe_manager) {

        super(10, 10, 294, 332, 'frmRecipe', null, null);
        this.canBeOpenedWith = ['frmInventory', 'frmCraft'];
        this.width *= this.zoom;
        this.height *= this.zoom;

        this.items_per_page     = 20;
        this.index              = -1;
        this.recipe_manager     = recipe_manager;

        // Ширина / высота слота
        this.cell_size = 50 * this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.background.image_size_mode = 'stretch';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-recipe.png');
        ct.hide();

        let items_count = this.recipe_manager.crafting_shaped.grouped.length;

        let that = this;

        // Paginator
        this.paginator = {
            pages: Math.ceil(items_count / this.items_per_page),
            page: 0,
            prev: function() {
                this.page--;
                this.update();
            },
            next: function() {
                this.page++;
                this.update();
            },
            update: function() {
                if(this.page < 0) {
                    this.page = this.pages - 1;
                }
                if(this.page >= this.pages) {
                    this.page = 0;
                }
                that.lblPages.title = (this.page + 1) + ' / ' + this.pages;
                that.createRecipes(that.cell_size);
            }
        };

        this.onShow = () => {
            // Создание слотов
            this.createRecipes(this.cell_size);
            this.paginator.update();
        };

        this.addPaginatorButtons();
        
        //constructor(x, y, w, h, id, title, text, ct, slot_index)
        let lbl12 = new FakeSlot(294 * this.zoom, 12 * this.zoom, 30 * this.zoom, 30 * this.zoom, 444, 'lbl1', 'dcdc', this, 67);
        ct.add(lbl12);

    }

    // Запоминаем какое окно вызвало окно рецептов
    assignCraftWindow(w) {
        this.craft_window = w;
    }

    // Paginator buttons
    addPaginatorButtons() {
        const ct = this;
        // Label
        let lblPages = new Label(110 * this.zoom, 270 * this.zoom, 70 * this.zoom, 40 * this.zoom, 'lblPages', '1 / 2');
        lblPages.style.color = '#ffffff';
        lblPages.style.font.shadow.enable = true;
        lblPages.style.textAlign.horizontal = 'center';
        lblPages.style.textAlign.vertical = 'middle';
        lblPages.style.font.shadow.x = 1;
        lblPages.style.font.shadow.y = 1;
        ct.add(lblPages);
        this.lblPages = lblPages;
        // Prev
        let btnPrev = new Button(65 * this.zoom, 270 * this.zoom, 40 * this.zoom, 40 * this.zoom, 'btnPrev', null);
        btnPrev.setBackground('./media/gui/btn_prev.png');
        btnPrev.onMouseDown = (e) => {
            this.paginator.prev();
        }
        ct.add(btnPrev);
        // Next
        let btnNext = new Button(185 * this.zoom, 270 * this.zoom, 40 * this.zoom, 40 * this.zoom, 'btnNext', null);
        btnNext.setBackground('./media/gui/btn_next.png');
        btnNext.onMouseDown = (e) => {
            this.paginator.next();
        }
        ct.add(btnNext);
    }

    /**
    * Создание слотов
    * @param int sz Ширина / высота слота
    */
    createRecipes(sz) {
        const ct = this;
        if(ct.recipes) {
            for(let w of ct.recipes) {
                this.delete(w.id);
            }
        }
        //
        let i           = 0;
        let sx          = 22 * this.zoom;
        let sy          = 62 * this.zoom;
        let xcnt        = 5;
        let list        = this.recipe_manager.crafting_shaped.grouped;
        let min_index   = this.paginator.page * this.items_per_page;
        let max_index   = min_index + this.items_per_page;
        this.recipes    = [];
        //
        for(let index in list) {
            if(index < min_index) {
                continue;
            }
            if(index >= max_index) {
                continue;
            }
            let recipe = list[index];
            let item_id = recipe.result.item_id;
            let block = BLOCK.fromId(item_id);
            let lblRecipe = new RecipeSlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * sz, sz, sz, 'lblRecipeSlot' + recipe.id, null, null, recipe, block);
            lblRecipe.tooltip = block.name.replaceAll('_', ' ') + ` (#${item_id})`;
            this.recipes.push(lblRecipe);
            ct.add(lblRecipe);
            lblRecipe.update();
            i++;
        }
    }

}