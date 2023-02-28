import { BLOCK } from "../blocks.js";
import { Button, Label, Window, TextEdit } from "../../tools/gui/wm.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";
import { BlankWindow } from "./blank.js";
import { getBlockImage } from "./tools/blocks.js";

export class RecipeSlot extends Window {
    [key: string]: any;

    constructor(x : int, y : int, w : int, h : int, id : string, title : string | null, text : string | null, recipe : any, block : any, ct? : Window) {

        super(x, y, w, h, id, title, text)

        //
        this.recipe = recipe
        this.block = block
        this.ct = ct

        const image = getBlockImage(block)
        this.setBackground(image, 'center', 1.25)
        this.swapChildren(this.children[0], this.children[1])

        //
        this.style.border.color = '#ffffffff';
        this.style.background.color = '#ffffff55';

    }

    // Custom drawing
    onMouseEnter(e) {
        this.style.background.color = this.can_make ? '#ffffffcc' : '#A1515177'
    }

    onMouseLeave(e) {
        this.style.background.color = this.can_make ? '#ffffff55' : '#A1515155'
    }

    onMouseDown(e) {
        const ct = this.ct
        ct.craft_window.setHelperSlots(null)
        if(!this.can_make) {
            ct.craft_window.clearCraft()
            ct.craft_window.setHelperSlots(e.target.recipe)
            return
        }
        for(const recipe of [this.recipe, ...this.recipe.subrecipes]) {
            if(this.canMake(recipe)) {
                ct.craft_window.autoRecipe(recipe, e.shiftKey)
                ct.paginator.update()
                break
            }
        }
    }

    canMake(recipe) {
        // TODO: Mayby need to replace Qubatch.player.inventory to this.ct?
        return Qubatch.player.inventory.hasResources(recipe.need_resources,
            this.ct.craft_window.getCraftSlotItemsArray()).missing.length == 0
    }

    update() {
        this.can_make = false;
        for(let recipe of [this.recipe, ...this.recipe.subrecipes]) {
            this.can_make = this.canMake(recipe)
            if(this.can_make) {
                break
            }
        }
        if(this.can_make) {
            let craft_area_size = this.parent.craft_window.area.size;
            this.can_make = this.recipe.size.width <= craft_area_size.width &&
                            this.recipe.size.height <= craft_area_size.height;
        }
        this.style.background.color = this.can_make ? '#ffffff55' : '#A1515155';
    }

}

// RecipeWindow...
export class RecipeWindow extends BlankWindow {
    [key: string]: any;

    constructor(recipe_manager) {

        super(10, 10, 592/2, 668/2, 'frmRecipe', null, null)
        this.canBeOpenedWith = ['frmInventory', 'frmCraft']

        this.zoom = UI_ZOOM  * Qubatch.settings.interface_size / 100
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom

        this.items_per_page     = 20
        this.index              = -1
        this.recipe_manager     = recipe_manager
        this.filter_text        = null
        this.only_can           = false

        // Ширина / высота слота
        this.cell_size = 50 * this.zoom

        // Get window by ID
        const ct = this

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/recipe_book.png').then(async atlas => {
            ct.setBackground(await atlas.getSprite(0, 0, 592, 668), 'none', this.zoom)
            // кнопка доступные или все рецепты
            this.addToggleButton()
        })

        const that = this

        // Paginator
        this.paginator = {
            pages: 0,
            page: 0,
            prev() {
                this.page--
                this.update()
            },
            next() {
                this.page++
                this.update()
            },
            update() {
                this.pages = Math.ceil(that.items_count / that.items_per_page)
                if(this.page < 0) {
                    this.page = this.pages - 1
                }
                if(this.page >= this.pages) {
                    this.page = 0
                }
                that.lblPages.text = this.pages == 0 ? '0/0' : (this.page + 1) + ' / ' + this.pages
                that.createRecipes()
            }
        };

        // кнопки пагинатора
        this.addPaginatorButtons()
        
        // строка поиска
        this.addFinder()

    }

    onKeyEvent(e) : boolean {
        return false
    }

    onShow(args) {
        // Создание слотов
        this.createRecipes()
        this.paginator.update()
        super.onShow(args)
    }

    // Запоминаем какое окно вызвало окно рецептов
    assignCraftWindow(w) {
        this.craft_window = w;
    }
    
    async addToggleButton() {

        const self = this
        const btnFilter = new Button(220 * this.zoom, 22 * this.zoom, 50 * this.zoom, 30 * this.zoom, 'btnFilter', null)

        this.atlas.getSprite(608, 162, 106, 67).then(image => {

            btnFilter.setBackground(image, 'none', self.zoom / 2)
            btnFilter.style.border.hidden = true

            btnFilter.onMouseDown = async function(e) {
                self.only_can = !self.only_can
                btnFilter.setBackground(await self.atlas.getSprite(self.only_can ? 719 : 608, 162, 106, 67), 'none', self.zoom / 2)
                self.createRecipes();
                self.paginator.update()
            }

            this.add(btnFilter)

        })

    }

    // Paginator buttons
    addPaginatorButtons() {

        const ct = this

        // Label
        const lblPages = new Label(110 * this.zoom, 268 * this.zoom, 70 * this.zoom, 45 * this.zoom, 'lblPages', '1 / 2')
        lblPages.style.font.size = 12 * this.zoom
        lblPages.style.font.color = '#ffffff'
        lblPages.style.font.shadow.enable = true
        lblPages.text_container.anchor.set(.5, .5)
        lblPages.style.textAlign.horizontal = 'center'
        lblPages.style.textAlign.vertical = 'middle'
        // lblPages.style.font.shadow.x = 1
        // lblPages.style.font.shadow.y = 1
        ct.add(lblPages)
        this.lblPages = lblPages
        lblPages.text_container.position.set(lblPages.w / 2, lblPages.h / 2)

        // Prev
        const btnPrev = new Button(65 * this.zoom, 270 * this.zoom, 40 * this.zoom, 40 * this.zoom, 'btnPrev', null)
        btnPrev.style.border.hidden = true
        btnPrev.setBackground('./media/gui/btn_prev.png', 'centerstretch', .5);
        btnPrev.onMouseDown = (e) => {
            this.paginator.prev()
        }
        ct.add(btnPrev)

        // Next
        const btnNext = new Button(185 * this.zoom, 270 * this.zoom, 40 * this.zoom, 40 * this.zoom, 'btnNext', null)
        btnNext.style.border.hidden = true
        btnNext.setBackground('./media/gui/btn_next.png', 'centerstretch', .5);
        btnNext.onMouseDown = (e) => {
            this.paginator.next()
        }
        ct.add(btnNext)

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
        txtSearch.word_wrap                = false
        txtSearch.focused                  = true
        txtSearch.max_length               = 100
        txtSearch.max_lines                = 1
        txtSearch.max_chars_per_line       = 20
        // style
        txtSearch.style.color              = '#ffffff';
        txtSearch.style.background.color   = '#ffffff88';
        txtSearch.style.border.hidden      = false
        txtSearch.style.font.size          = 14 * this.zoom
        txtSearch.style.textAlign.vertical = 'middle'
        this.add(txtSearch);
        
        txtSearch.onChange = (text) => {
            this.filter_text = text;
            this.createRecipes();
            this.paginator.update();
        };
    }
    

    /**
    * Создание слотов
    */
    createRecipes() {

        this.craft_window.setHelperSlots(null)

        if(this.recipes) {
            for(let i = this.recipes.length - 1; i >= 0; i--) {
                this.removeChild(this.recipes[i])
            }
            // for(let w of ct.recipes) {
            //     this.delete(w.id)
            // }
        }

        const canMake = (recipes) => {
            for(const recipe of [recipes, ...recipes.subrecipes]) {
                // TODO: Mayby need to replace Qubatch.player.inventory to ct?
                if(Qubatch.player.inventory.hasResources(recipe.need_resources,
                    this.craft_window.getCraftSlotItemsArray()).missing.length == 0
                ) {
                    return true
                }
            }
            return false
        }

        //
        let i               = 0;
        const sz            = this.cell_size;
        const sx            = 22 * this.zoom;
        const sy            = 62 * this.zoom;
        const xcnt          = 5;
        const list          = this.recipe_manager.crafting_shaped.grouped;
        const min_index     = this.paginator.page * this.items_per_page;
        const max_index     = min_index + this.items_per_page;
        const size          = this.craft_window.area.size.width;
        const filter_text   = (this.filter_text) ? this.filter_text.toUpperCase().replaceAll('_', ' ').replace(/\s\s+/g, ' ') : null;

        this.recipes        = []
        
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

        for(let index = 0; index < tmp_recipes.length; index++) {
            if(index < min_index) {
                continue;
            }
            if(index >= max_index) {
                continue;
            }
            const recipe = tmp_recipes[index]
            const id = recipe.result.item_id
            const block = BLOCK.fromId(id)
            const lblRecipe = new RecipeSlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * sz, sz, sz, 'lblRecipeSlot' + id, null, null, recipe, block, this);
            lblRecipe.tooltip = block.name.replaceAll('_', ' ') + ` (#${id})`
            lblRecipe.style.border.hidden = false
            lblRecipe.style.border.style = 'inset'
            this.recipes.push(lblRecipe)
            this.add(lblRecipe)
            lblRecipe.update()
            i++;
        }
        
    }

}