import {Button, Label, TextEdit, Window} from "../ui/wm.js";
import { CraftTableInventorySlot } from "./base_craft_window.js";
import { BLOCK } from "../blocks.js";
import { Enchantments } from "../enchantments.js";
import { BLOCK_GROUP_TAG, INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH, UI_THEME } from "../constant.js";
import { BlankWindow } from "./blank.js";
import type {PlayerInventory} from "../player_inventory.js";
import type {World} from "../world.js";
import type {TMouseEvent} from "../vendors/wm/wm.js";

const ITEMS_WITHOUT_TAG = '#others';
const ITEMS_ALL_TAG = BLOCK_GROUP_TAG.ALL;

class CreativeInventoryCollection extends Window {
    [key: string]: any;

    slots : CraftTableInventorySlot[] = []
    xcnt : int = 0
    ycnt : int = 13

    //
    constructor(x : int, y : int, w : int, h : int, id : string, xcnt : int, ycnt : int, cell_size : float, slot_margin: float) {

        super(x, y, w, h, id)

        // Ширина / высота слота
        this.cell_size = cell_size
        this.slot_margin = slot_margin

        this.xcnt   = xcnt
        this.ycnt   = ycnt

        this.max_height                 = 0
        this.slots_count                = 0
        this.style.background.color     = '#00000000'
        this.style.border.hidden        = true

        this.container = new Window(0, 0, this.w, this.h, this.id + '_container')
        this.add(this.container)

        // create clip mask
        this.clip()

    }

    _wheel(e) {
        const sz    = this.cell_size
        const szm   = sz + this.slot_margin
        this.scrollY += Math.sign(e.original_event.wheelDeltaY) * szm
        this.scrollY = Math.min(this.scrollY, 0)
        this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.h, 0) * -1)
        this.container.y = this.scrollY
        this.updateVisibleSlots()
    }

    updateVisibleSlots() {
        const sz            = this.cell_size
        const szm           = sz + this.slot_margin
        const start_index   = Math.floor((-this.scrollY / szm) * this.xcnt)
        const end_index     = start_index + (this.xcnt * this.ycnt)
        for(let i = 0; i < this.slots_count; i++) {
            const child = this.slots[i]
            child.visible = i >= start_index && i < end_index
        }
    }

    // Init
    init(filter_text = null, tag = null) {
        //
        const all_blocks = [];
        if(filter_text) {
            filter_text = filter_text
                .toUpperCase()
                .replaceAll('_', ' ')
                .replace(/\s\s+/g, ' ')
        }
        for(let b of BLOCK.getAll()) {
            if(b.id < 1 || !b.spawnable) {
                continue
            }
            const block = {
                id: b.id
            };
            if('power' in b && (b.power !== 0)) {
                (block as any).power = b.power
            }
            if(!this.matchesFilter(b, filter_text) || !this.matchesTag(b, tag)) {
                continue
            }
            all_blocks.push(block)
        }
        this.addEnchantedBooks(all_blocks, filter_text, tag)
        // Create slots
        // let p = performance.now()
        this.initCollection(all_blocks)
        // console.log(performance.now() - p)
    }

    matchesFilter(block, filter_text) {
        return !filter_text || block.name.replaceAll('_', ' ').indexOf(filter_text) >= 0 || block.id == filter_text
    }

    matchesTag(block, tag) {
        if (!tag) return true;
        tag = '#' + tag;
        if (tag == ITEMS_ALL_TAG) return true;
        // if special tag was chosen then return all blocks without tags
        if (tag == ITEMS_WITHOUT_TAG) {
            return block.tags.length == 0 || block.tags.findIndex(t => t.slice(0, 1) == '#') == -1;
        } else {
            return block.tags.indexOf(tag) > -1;
        }
    }

    addEnchantedBooks(all_blocks, filter_text, tag) {
        const EB = BLOCK.ENCHANTED_BOOK;
        if(!EB || !this.matchesFilter(EB, filter_text) || !this.matchesTag(EB,tag)) {
            return;
        }
        for(const e of Enchantments.list) {
            if (e.in_creative_inventory) {
                for(let level = 1; level <= e.max_level; level++) {
                    const block = {
                        id: EB.id,
                        extra_data: {
                            enchantments: {}
                        }
                    };
                    block.extra_data.enchantments[e.id] = level;
                    all_blocks.push(block);
                }
            }
        }
    }

    // Init collection
    initCollection(all_blocks) {

        // remove all childrens
        for(let i = 0; i < this.slots.length; i++) {
            this.slots[i].visible = false
        }

        this.slots_count        = all_blocks.length
        this.scrollY            = 0
        this.container.y        = 0

        let sx                  = 0
        let sy                  = 0
        let sz                  = this.cell_size
        let szm                 = sz + this.slot_margin
        let xcnt                = this.xcnt

        // Drop on pallette slots
        const dropFunc = function(e) {
            const that      = this
            const drag      = e.drag
            // prevent dropping into the same sloft after the mouse is released
            if(drag?.slot === this) {
                drag.slot = null
                return
            }
            const dropItem  = drag.getItem() // что перетащили
            let targetItem  = this.getItem() // куда перетащили
            if(targetItem && dropItem.id == targetItem.id) {
                targetItem = {...dropItem}
                // calc count
                let count = 1
                const max_in_stack = BLOCK.fromId(targetItem.id).max_in_stack;
                if(e.shiftKey) {
                    count = max_in_stack
                }
                targetItem.count = Math.min(targetItem.count + count, max_in_stack)
                this.getInventory().setDragItem(this, {...targetItem}, drag, that.w, that.height)
            } else {
                this.getInventory().clearDragItem()
            }
            return false;
        }

        const onMouseDownFunc = function(e) {
            const that = this
            let targetItem = this.getItem()
            // Set new drag
            if(!targetItem) {
                return
            }
            // calc count
            let count = 1
            if(e.shiftKey) {
                count = BLOCK.fromId(targetItem.id).max_in_stack
            }
            //
            targetItem = {...targetItem}
            targetItem.count = count
            this.getInventory().setDragItem(this, targetItem, e.drag, that.w, that.height)
            return false
        }

        for(let i = 0; i < all_blocks.length; i++) {

            if(i >= this.slots.length) {
                this.slots.push(null)
            }

            let lblSlot = this.slots[i]
            if(!lblSlot) {
                lblSlot = this.slots[i] = new CraftTableInventorySlot(0, 0, sz, sz, 'lblCollectionSlot' + (i), null, null, this.parent, null)
                lblSlot.style.border.style = 'inset'
                lblSlot.style.border.shadow_color = '#00000000'
                lblSlot.style.border.color = '#00000055'
                lblSlot.onDrop = dropFunc
                lblSlot.onMouseDown = onMouseDownFunc
                this.container.add(lblSlot)
            }

            lblSlot.x = sx + (i % xcnt) * szm
            lblSlot.y = sy + Math.floor(i / xcnt) * szm

            lblSlot.setItem(all_blocks[i])

        }

        this.max_height = Math.ceil(all_blocks.length / xcnt) * szm - (szm - sz)
        this.container.h = this.max_height

        this.updateVisibleSlots()

    }

}

// CreativeInventoryWindow...
export class CreativeInventoryWindow extends BlankWindow {
    [key: string]: any;

    collection : CreativeInventoryCollection
    world       : World
    inventory   : PlayerInventory

    tagLevels : number = 0;
    selectedTag: string = '';
    tagButtons: Button[] = [];

    constructor(inventory: PlayerInventory) {
        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmCreativeInventory')
        this.w *= this.zoom
        this.h *= this.zoom
        this.inventory = inventory
        this.world = inventory.player.world
    }

    initControls() {

        // Search input
        this.createSearchInput()

        // Ширина / высота слота
        this.xcnt = 18
        let szm = this.txtSearch.w / this.xcnt
        szm += (szm - szm / 1.1) / this.xcnt
        const sz = szm / 1.1
        this.cell_size = sz
        this.slot_margin = szm - sz

        // Создание слотов для блоков коллекций
        this.createCollectionSlots()

        // Создание слотов для инвентаря
        this.createInventorySlots()

    }

    //
    createCollectionSlots() {
        if(this.collection) {
            console.error('error_create_collection_slots_already_created')
            return
        }
        const szm = this.cell_size + this.slot_margin
        const w = this.txtSearch.w
        const tagsMargin = this.tagLevels * 25 * this.zoom + 10 * this.tagLevels;
        const h = (Math.floor((this.h - this.txtSearch.y - this.txtSearch.h - tagsMargin) / szm) - 1) * szm
        // calculate height of tags area
        this.ycnt = Math.floor(h / szm)
        this.collection = new CreativeInventoryCollection(16 * this.zoom, 45 * this.zoom + tagsMargin, w, h - this.slot_margin, 'wCollectionSlots', this.xcnt, this.ycnt, this.cell_size, this.slot_margin)
        this.add(this.collection)
        this.collection.init()
        return this.collection
    }

    // Search input
    createSearchInput() {
        // Text editor
        const x = 16 * this.zoom
        const txtSearch = new TextEdit(
            x,
            10 * this.zoom,
            // this.cell_size * 9,
            this.w - x * 2,
            25 * this.zoom,
            'txtSearch1',
            null,
            'Type for search'
        )

        txtSearch.word_wrap              = false
        txtSearch.focused                = true
        txtSearch.max_length             = 100
        txtSearch.max_lines              = 1
        txtSearch.max_chars_per_line     = 20

        // style
        txtSearch.style.border.hidden       = false
        // txtSearch.style.border.style     = 'inset'
        // txtSearch.style.font.color          = '#ffffff'
        // txtSearch.style.background.color = '#706f6c'
        txtSearch.style.padding.left        = 5 * this.zoom
        txtSearch.style.textAlign.vertical  = 'middle'
        this.add(txtSearch)
        this.txtSearch = txtSearch

        txtSearch.onChange = (text) => {
            this.collection.init(text, this.selectedTag)
        }

        const tags = [ITEMS_ALL_TAG];
        for (let b of BLOCK.getAll()) {
            if (b.id < 1 || !b.spawnable || b.tags.length == 0) {
                continue;
            }
            for (let t of b.tags) {
                if (t.slice(0, 1) != '#') continue;

                if (tags.indexOf(t) == -1) {
                    tags.push(t);
                }
            }
        }

        tags.sort()

        // add special tag to end
        // tags.push(ITEMS_WITHOUT_TAG);
        const btnMarginX = 10 * this.zoom;
        const btnMarginY = 10 * this.zoom;
        // manually chosen 'optimal' coefficient to add horizontal spaces to buttons
        // too high value will lead to big spaces on long words
        // without this coefficient there are no gaps between borders and letters
        const btnMargin = 5 * this.zoom;
        let ty = 10 * this.zoom + txtSearch.h + btnMarginY;
        const buttonHeight = 25 * this.zoom;
        if (tags.length > 0) {
            this.tagLevels = 1;
        }
        const tmpLabel = new Label(0, 0, 0, 0, 'tmpLabel');
        let btnX = x;
        for (let i = 0; i < tags.length; i++) {
            let t = tags[i].slice(1);
            // if next button with be outside container, move to next line and start from left again
            tmpLabel.text = t;
            const buttonWidth = tmpLabel.getTextMetrics(null).width + 4 * btnMargin;
            if (btnX + buttonWidth > this.txtSearch.w) {
                btnX = x;
                ty += buttonHeight + btnMarginY;
                this.tagLevels++;
            }
            const button = new Button(
                btnX,
                ty,
                buttonWidth,
                buttonHeight,
                `tag${i}`,
                t,
                t
            );
            button.w = button.getTextMetrics(null).width + 4 * btnMargin;

            button.setInactive = () => {
                button.style.border.hidden = true;
                button.style.background.color = '#ffffff22';
            }
            button.setActive = () => {
                button.style.border.hidden = false;
                button.style.background.color = UI_THEME.button.background.color;
            }
            if ('#' + t == ITEMS_ALL_TAG) {
                button.setActive();
            } else {
                button.setInactive();
            }
            this.add(button);
            this.tagButtons.push(button);
            button.onMouseUp = e => {
                const selectedTag = this.getWindow(e.target.id);
                if (selectedTag.text == this.selectedTag) {
                    button.setInactive();
                    this.selectedTag = ITEMS_ALL_TAG.slice(1);
                    this.tagButtons.find(b => '#' + b.text == ITEMS_ALL_TAG)?.setActive();
                } else {
                    this.tagButtons.forEach(b => b.setInactive())
                    selectedTag.setActive();
                    this.selectedTag = selectedTag.text;
                }
                this.collection.init(this.txtSearch.text, this.selectedTag);
            };
            button.onMouseEnter = () => super.onMouseEnter();
            button.onMouseLeave = () => super.onMouseLeave();
            btnX += button.w + btnMarginX;
        }
    }

    // Обработчик открытия формы
    onShow(args) {
        // this.getRoot().center(this);
        // Qubatch.releaseMousePointer()
        if(this.inventory_slots) {
            for(let slot of this.inventory_slots) {
                if(slot) {
                    slot.refresh()
                }
            }
        }
        super.onShow(args)
    }

    // Обработчик закрытия формы
    onHide() {
        const thrown_item = this.inventory.clearDragItem()
        // Save inventory
        this.world.server.InventoryNewState({
            state: this.inventory.exportItems(),
            thrown_items: [thrown_item],
            dont_check_equal: true
        })
    }

    /**
    * Создание слотов для инвентаря
    */
    createInventorySlots() {
        if(this.inventory_slots) {
            console.error('createInventorySlots() already created')
            return
        }
        const sz = this.cell_size // Ширина / высота слота
        const szm = sz + this.slot_margin // Ширина / высота слота
        this.inventory_slots = []
        // нижний ряд (видимые на хотбаре)
        const sx          = 16 * this.zoom
        const sy          = this.collection.y + this.collection.h + 10 * this.zoom
        const xcnt        = 9
        const init_x        = (this.w / 2 - sx) - (xcnt * szm) / 2
        for(let i = 0; i < xcnt; i++) {
            const lblSlot = new CraftTableInventorySlot(init_x + sx + (i % xcnt) * (szm), sy + Math.floor(i / xcnt) * this.cell_size, sz, sz, 'lblSlot' + (i), null, '' + i, this, i)
            this.add(lblSlot)
            this.inventory_slots.push(lblSlot)
        }
    }

    // Return inventory slots
    getSlots() {
        return this.inventory_slots;
    }

    fixAndValidateSlots(context) {
        // Do nothing. It's called by slots and used to validate in other windows.
    }

    onDropOutside(e: TMouseEvent): boolean {
        // just clear the drag without creating a drop item
        return this.inventory.clearDragItem(false) != null
    }
}