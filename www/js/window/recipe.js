import { BLOCK } from "../blocks.js";
import { Button, Label, Window, TextEdit } from "../../tools/gui/wm.js";
import { Resources } from "../resources.js";
import { INVENTORY_ICON_COUNT_PER_TEX } from "../chunk_const.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";

const COLOR_RED = '#A15151';

export class RecipeSlot extends Window {

    constructor(x, y, w, h, id, title, text, recipe, block, ct) {
        super(x, y, w, h, id, title, text);
        //
        this.recipe = recipe;
        this.block = block;
        this.ct = ct;
        //
        this.style.border.color = '#ffffffff';
        this.style.background.color = '#ffffff55';
        // Custom drawing
        this.onMouseEnter = function(e) {
            this.style.background.color = this.can_make ? '#ffffffcc' : COLOR_RED + '77';
        }
        this.onMouseLeave = function(e) {
            this.style.background.color = this.can_make ? '#ffffff55' : COLOR_RED + '55';
        }
        this.onMouseDown = function(e) {
            this.ct.craft_window.setHelperSlots(null);
            if(!this.can_make) {
                this.ct.craft_window.clearCraft();
                this.ct.craft_window.setHelperSlots(e.target.recipe);
                return;
            }
            for(const recipe of [this.recipe, ...this.recipe.subrecipes]) {
                if(this.canMake(recipe)) {
                    this.parent.craft_window.autoRecipe(recipe, e.shiftKey);
                    this.parent.paginator.update();
                    break;
                }
            }
        };
    }

    canMake(recipe) {
        return Qubatch.player.inventory.hasResources(recipe.need_resources,
            this.ct.craft_window.getCraftSlotItemsArray()).missing.length == 0;
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
        this.style.background.color = this.can_make ? '#ffffff55' : COLOR_RED + '55';
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
            const icon = BLOCK.getInventoryIconPos(item.inventory_icon_id, size, frame);
            const dest_icon_size = 48 * this.zoom;
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

        super(10, 10, 592/2, 668/2, 'frmRecipe', null, null)
        this.canBeOpenedWith = ['frmInventory', 'frmCraft']
        this.w *= this.zoom
        this.h *= this.zoom

        this.items_per_page     = 20;
        this.index              = -1;
        this.recipe_manager     = recipe_manager;
        this.filter_text        = null;
        this.only_can           = false;

        // Ширина / высота слота
        this.cell_size = 50 * this.zoom;

        // Get window by ID
        const ct = this

        // Create sprite atlas
        this.atlas = new SpriteAtlas()

        this.atlas.fromFile('./media/gui/recipe_book.png').then(async atlas => {

            ct.setBackground(await atlas.getSprite(0, 0, 592, 668), 'none', this.zoom / 2.0)

            // кнопка доступные или все рецепты
            this.addToggleButton()

        })

        ct.style.background.color = '#00000000'
        ct.style.border.hidden = true
        ct.hide()

        const that = this;

        // Paginator
        this.paginator = {
            pages: 0,
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
                this.pages = Math.ceil(that.items_count / that.items_per_page);
                if(this.page < 0) {
                    this.page = this.pages - 1;
                }
                if(this.page >= this.pages) {
                    this.page = 0;
                }
                that.lblPages.title = this.pages == 0 ? '0/0' : (this.page + 1) + ' / ' + this.pages;
                that.createRecipes();
            }
        };

        this.onShow = () => {
            // Создание слотов
            this.createRecipes();
            this.paginator.update();
        };

        // кнопки пагинатора
        this.addPaginatorButtons();
        
        // строка поиска
        this.addFinder()

    }

    // Запоминаем какое окно вызвало окно рецептов
    assignCraftWindow(w) {
        this.craft_window = w;
    }
    
    async addToggleButton() {

        const self = this
        const btnFilter = new Button(220 * this.zoom, 22 * this.zoom, 50 * this.zoom, 30 * this.zoom, 'btnFilter', null)

        this.atlas.getSprite(608, 162, 106, 67).then(image => {

            btnFilter.setBackground(image, 'none', this.zoom / 2.0)
            btnFilter.style.border.hidden = true

            btnFilter.onMouseDown = async function(e) {
                self.only_can = !self.only_can
                btnFilter.setBackground(await self.atlas.getSprite(self.only_can ? 719 : 608, 162, 106, 67), 'none', this.zoom / 2.0)
                self.createRecipes();
                self.paginator.update()
            }

            this.add(btnFilter)

        })

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
    
    addFinder() {
        // Text editor
        const txtSearch = new TextEdit(
            50 * this.zoom,
            26 * this.zoom,
            160 * this.zoom,
            22 * this.zoom,
            'txtSearch1',
            null,
            'Type for search'
        );
        txtSearch.word_wrap              = false;
        txtSearch.focused                = true;
        txtSearch.max_length             = 100;
        txtSearch.max_lines              = 1;
        txtSearch.max_chars_per_line     = 20;
        // style
        txtSearch.style.color            = '#fff';
        txtSearch.style.border.hidden    = true;
        txtSearch.style.border.style     = 'inset';
       // txtSearch.style.background.color = '#706f6cff';
        this.add(txtSearch);
        
        txtSearch.onChange = (text) => {
            this.filter_text = text;
            this.createRecipes();
            this.paginator.update();
        };
    }
    

    /**
    * Создание слотов
    * @param int sz Ширина / высота слота
    */
    createRecipes() {
        this.craft_window.setHelperSlots(null);
        const ct = this;
        if(ct.recipes) {
            for(let w of ct.recipes) {
                this.delete(w.id);
            }
        }
        const canMake = (recipes) => {
            for(const recipe of [recipes, ...recipes.subrecipes]) {
                if(Qubatch.player.inventory.hasResources(recipe.need_resources,
                    this.craft_window.getCraftSlotItemsArray()).missing.length == 0
                ) {
                    return true
                }
            }
            return false;
        }
        //
        let i             = 0;
        const sz          = this.cell_size;
        const sx          = 22 * this.zoom;
        const sy          = 62 * this.zoom;
        const xcnt        = 5;
        const list        = this.recipe_manager.crafting_shaped.grouped;
        const min_index   = this.paginator.page * this.items_per_page;
        const max_index   = min_index + this.items_per_page;
        const size      = this.craft_window.area.size.width;
        const filter_text = (this.filter_text) ? this.filter_text.toUpperCase().replaceAll('_', ' ').replace(/\s\s+/g, ' ') : null;
        this.recipes    = [];
        
        const tmp_recipes = [];
        for(const index in list) {
            const recipe = list[index];
            if (!canMake(recipe) && this.only_can) {
                continue;
            }
            if (!recipe.adaptivePatterns[size].length) {
                continue;
            }
            const block = BLOCK.fromId(recipe.result.item_id);
            if (filter_text) {
                if (!block.name.replaceAll('_', ' ').includes(filter_text) && block.id != filter_text) {
                    continue;
                }
            }
            tmp_recipes.push(recipe);
        }
        
        this.items_count = tmp_recipes.length;
        
        for (const index in tmp_recipes) {
            if(index < min_index) {
                continue;
            }
            if(index >= max_index) {
                continue;
            }
            const recipe = tmp_recipes[index];
            const id = recipe.result.item_id;
            const block = BLOCK.fromId(id);
            const lblRecipe = new RecipeSlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * sz, sz, sz, 'lblRecipeSlot' + id, null, null, recipe, block, this);
            lblRecipe.tooltip = block.name.replaceAll('_', ' ') + ` (#${id})`;
            this.recipes.push(lblRecipe);
            ct.add(lblRecipe);
            lblRecipe.update();
            i++;
        }
        
    }

}