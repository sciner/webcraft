import { BLOCK } from "../blocks.js";
import { Button, Label, Window, TextEdit } from "../ui/wm.js";
// import { SpriteAtlas } from "../core/sprite_atlas.js";
import { BlankWindow } from "./blank.js";
import { getBlockImage } from "./tools/blocks.js";
import type { RecipeManager } from "../recipes.js";
import { Resources } from "../resources.js";
import { UI_THEME } from "../constant.js";
import { Lang } from "../lang.js";

export class RecipeSlot extends Window {
    [key: string]: any;

    // hud_atlas : SpriteAtlas

    constructor(x : int, y : int, w : int, h : int, id : string, title : string | null, text : string | null, recipe : any, block : any, ct? : Window) {

        super(x, y, w, h, id, title, text)

        //
        this.recipe = recipe
        this.block = block
        this.ct = ct
        this.interactiveChildren = false

        const image = getBlockImage(block)
        this.setIcon(image, 'center', 1.25)

        this.hud_atlas = Resources.atlas.get('hud')
        if(this.hud_atlas) {
            this.setBackground(this.hud_atlas.getSpriteFromMap('window_slot_locked'))
            this.swapChildren(this._wmicon, this._wmbgimage)
        }

    }

    // Custom drawing
    onMouseEnter(e) {
        // this.style.background.color = this.can_make ? '#00000000' : '#A1515177'
    }

    onMouseLeave(e) {
        // this.style.background.color = this.can_make ? '#00000000' : '#A1515155'
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
        // this.style.background.color = this.can_make ? '#00000000' : '#A1515155';
        // this._wmbgimage.alpha = this.can_make ? 1 : .2
        this._wmicon.alpha = this.can_make ? 1 : .2
        this.style.background.sprite.tintMode = this.can_make ? 0 : 2
    }

}

// RecipeWindow...
export class RecipeWindow extends BlankWindow {

    // hud_atlas : SpriteAtlas
    slot_margin : float
    cell_size : float
    slots_x : float
    slots_y : float

    constructor(recipe_manager : RecipeManager, id : string = 'frmRecipe') {

        super(10, 10, 592/2, 342, id, null, null)
        this.canBeOpenedWith = ['frmInventory', 'frmCraft']
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
        this.cell_size          = UI_THEME.window_slot_size * this.zoom
        this.slot_margin        = UI_THEME.slot_margin * this.zoom
        this.slots_x            = UI_THEME.window_padding * this.zoom * 2.5
        this.slots_y            = 62 * this.zoom;

        this.hud_atlas = Resources.atlas.get('hud')

        // Get window by ID
        const ct = this

        // // Create sprite atlas
        // this.atlas = new SpriteAtlas()
        // this.atlas.fromFile('./media/gui/recipe_book.png').then(async atlas => {
        //     ct.setBackground(await atlas.getSprite(0, 0, 592, 668), 'none', this.zoom)
        //     // кнопка доступные или все рецепты
        //     this.addToggleButton()
        // })

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
        }

        // кнопки пагинатора
        this.addPaginatorButtons()

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
        const btnFilter = new Button(220 * this.zoom, 22 * this.zoom, 50 * this.zoom, 30 * this.zoom, 'btnFilter', Lang.only_can)

        // this.atlas.getSprite(608, 162, 106, 67).then(image => {

            // btnFilter.setBackground(image, 'none', self.zoom / 2)
            btnFilter.style.border.hidden = true

            btnFilter.onMouseDown = async function(e) {
                self.only_can = !self.only_can
                // btnFilter.setBackground(await self.atlas.getSprite(self.only_can ? 719 : 608, 162, 106, 67), 'none', self.zoom / 2)
                self.createRecipes();
                self.paginator.update()
            }

            this.add(btnFilter)

        // })

    }

    // Paginator buttons
    addPaginatorButtons() {

        const ct = this
        const sz = this.cell_size
        const szm = sz + this.slot_margin
        const sy = this.slots_y + szm * 4 + sz * 0.5
        const x = this.slots_x + szm
        const w = szm * 3 - this.slot_margin
        const h = 25 * this.zoom

        // Text editor
        const txtSearch = new TextEdit(x, sy, w, h, 'txtSearch1', null, 'Type for search')
        txtSearch.word_wrap                 = false
        txtSearch.focused                   = true
        txtSearch.max_length                = 100
        txtSearch.max_lines                 = 1
        txtSearch.max_chars_per_line        = 20
        txtSearch.style.padding.left        = 5 * this.zoom
        txtSearch.style.font.size           = 12
        txtSearch.style.textAlign.vertical  = 'middle'
        this.add(txtSearch);
        
        txtSearch.onChange = (text : string) => {
            this.filter_text = text;
            this.createRecipes();
            this.paginator.update();
        }

        // Prev
        const btnPrev = new Button(txtSearch.x - h - this.slot_margin, sy, h, h, 'btnPrev', null)
        btnPrev.style.border.hidden = true
        btnPrev.setBackground(this.hud_atlas.getSpriteFromMap('arrow_prev_big'), 'centerstretch', .5);
        btnPrev.onMouseDown = (e) => {
            this.paginator.prev()
        }
        ct.add(btnPrev)

        // Next
        const nx = this.slots_x + szm * 4
        const btnNext = new Button(nx, sy, h, h, 'btnNext', null)
        btnNext.style.border.hidden = true
        btnNext.setBackground(this.hud_atlas.getSpriteFromMap('arrow_next_big'), 'centerstretch', .5);
        btnNext.onMouseDown = (e) => {
            this.paginator.next()
        }
        ct.add(btnNext)

        // Pages
        const lblPages = new Label(x, sy - sz * 0.5, w, 15 * this.zoom, 'lblPages', '1 / 2')
        lblPages.style.font.color = UI_THEME.second_text_color
        lblPages.style.font.size = 10
        lblPages.text_container.anchor.set(.5, .5)
        lblPages.style.textAlign.horizontal = 'center'
        lblPages.style.textAlign.vertical = 'middle'
        ct.add(lblPages)
        this.lblPages = lblPages
        lblPages.text_container.position.set(lblPages.w / 2, lblPages.h / 2)

    }

    /**
    * Создание слотов
    */
    createRecipes() {

        if(!this.craft_window) {
            return
        }

        this.craft_window.setHelperSlots(null)

        if(this.recipes) {
            for(let i = this.recipes.length - 1; i >= 0; i--) {
                this.removeChild(this.recipes[i])
            }
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
        const sz            = this.cell_size
        const szm           = sz + this.slot_margin
        const sx            = this.slots_x
        const sy            = this.slots_y
        const xcnt          = 5;
        const list          = this.recipe_manager.crafting_shaped.grouped;
        const min_index     = this.paginator.page * this.items_per_page;
        const max_index     = min_index + this.items_per_page;
        const size          = this.craft_window.area.size.width;
        const filter_text   = (this.filter_text) ? this.filter_text.toUpperCase().replaceAll('_', ' ').replace(/\s\s+/g, ' ') : null;

        this.recipes        = []

        // Заголовок списка рецептов
        if(!this.list.has('lblRecipesTitle')) {
            const labels = [
                new Label(sx, sy - 23 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lblRecipesTitle', null, Lang.recipes),
            ]
            for(let lbl of labels) {
                lbl.style.font.color = UI_THEME.label_text_color
                lbl.style.font.size = UI_THEME.base_font.size
                this.add(lbl)
            }
        }
        
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
                continue
            }
            if(index >= max_index) {
                continue
            }
            const recipe = tmp_recipes[index]
            const id = recipe.result.item_id
            const block = BLOCK.fromId(id)
            const x = sx + (i % xcnt) * szm
            const y = sy + Math.floor(i / xcnt) * szm
            const lblRecipe = new RecipeSlot(x, y, sz, sz, 'lblRecipeSlot' + id, null, null, recipe, block, this);
            lblRecipe.tooltip = block.name.replaceAll('_', ' ') + ` (#${id})`
            this.recipes.push(lblRecipe)
            this.add(lblRecipe)
            lblRecipe.update()
            i++;
        }
        
    }

}