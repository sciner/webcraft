import { Label } from "../ui/wm.js";
import { BaseCraftWindow, PaperDollSlot } from "./base_craft_window.js";
import { Lang } from "../lang.js";
import { INVENTORY_HOTBAR_SLOT_COUNT, PAPERDOLL_BACKPACK, PAPERDOLL_BOOTS, PAPERDOLL_CHESTPLATE, PAPERDOLL_HELMET, PAPERDOLL_LEGGINGS, PAPERDOLL_TOOLBELT, UI_THEME } from "../constant.js";
import type { InventoryRecipeWindow } from "./inventory_recipe.js";
import type { PlayerInventory } from "../player_inventory.js";
import type { InGameMain } from "./ingamemain.js";
import type { Player } from "../player.js";
import { Resources } from "../resources.js";
import {PixiGuiPlayer} from "../vendors/wm/pixi_gui_player.js";

// const PLAYER_BOX_WIDTH = 409 / 2;
// const PLAYER_BOX_HEIGHT = 620 / 4;

export class CharacterWindow extends BaseCraftWindow { // BlankWindow {

    frmInventoryRecipe : InventoryRecipeWindow
    paperdoll : PaperDollSlot[] = []
    player : Player

    slot_empty = 'slot_empty'
    slot_full = 'slot_full'

    constructor(player : Player, inventory : PlayerInventory) {

        const w = 350
        const h = 166

        super(0, 0, w, h, 'frmCharacterWindow', null, null, inventory)
        this.w *= this.zoom
        this.h *= this.zoom

        this.player = player
        this.skinKey = null
        this.skinViewer = null // lazy initialized if necessary

        // Craft area
        this.area = {
            size: {
                width: 2,
                height: 2
            }
        };

    }

    initControls(parent : InGameMain) {

        this.hud_atlas = Resources.atlas.get('hud')

        // Ширина / высота слота
        this.cell_size = UI_THEME.window_slot_size * this.zoom

        const slots_width = (((this.cell_size / this.zoom) + UI_THEME.slot_margin) * INVENTORY_HOTBAR_SLOT_COUNT) - UI_THEME.slot_margin + UI_THEME.window_padding

        // Создание слотов для инвентаря
        const x = this.w / this.zoom - slots_width
        const y = 35
        this.createInventorySlots(this.cell_size, x, y, UI_THEME.window_padding, undefined, true)

        // кнопка сортировки
        this.createButtonSort()
        
        // слот для удаления преметов
        this.createDeleteSlot(this.cell_size)

        // Создания слота для армора
        this.createLeftPaperDoll(this.cell_size)

        //
        this.addPlayerBox()

        this.createRightPaperDoll(this.cell_size)

        // обновить gui
        this.refresh()

        for(const slot of this.paperdoll) {
            slot.onSetItem = () => {
               // this.player.getModel().updateArmor()
                this.refresh()
                //this.autoSortItems()
            }
        }

    }

    // Обработчик открытия формы
    onShow(args) {
        this.previewSkin()
        super.onShow(args)
    }

    // Обработчик закрытия формы
    onHide() {
        this.lblPlayerBox?.removeChildren();
        // Drag
        this.inventory.clearDragItem(true)
        // Update player mob model
        this.inventory.player.updateArmor()
        // Save inventory
        this.autoSortItems()
        //this.world.server.InventoryNewState({ state: this.inventory.exportItems() })
        if(this.skinViewer) {
            this.skinViewer.renderPaused = true
        }
    }

    async previewSkin() {
        const guiPlayer = new PixiGuiPlayer() as any
        guiPlayer.transform.position.set(this.lblPlayerBox.w / 2, this.lblPlayerBox.h)
        guiPlayer.transform.scale.set(this.zoom * 1.4, this.zoom * 1.4)
        this.lblPlayerBox?.addChild(guiPlayer)
    }

    addPlayerBox() {
        const ct = this;

        const sprite_character_back = this.hud_atlas.getSpriteFromMap('char_back')
        const armor_slot = this.paperdoll[0]
        const margin = UI_THEME.slot_margin * this.zoom

        const PLAYER_BOX_HEIGHT = (this.cell_size + margin) * 4 - margin
        const PLAYER_BOX_WIDTH = PLAYER_BOX_HEIGHT * (sprite_character_back.width / sprite_character_back.height)

        this.lblPlayerBox = new Label(armor_slot.x + armor_slot.w + margin, armor_slot.y, PLAYER_BOX_WIDTH, PLAYER_BOX_HEIGHT, 'lblPlayerBox', null, null)
        // this.lblPlayerBox.setBackground(sprite_character_back)
        this.lblPlayerBox.style.background.color = '#00000000'

        ct.add(this.lblPlayerBox)
    }

    createLeftPaperDoll(sz : float) {

        const ct = this;
        const x = UI_THEME.window_padding * this.zoom

        let y = 16 * this.zoom

        const getY = () => {
            const resp = y
            y += sz + UI_THEME.slot_margin * this.zoom
            return resp
        }

        const lblSlotHead = new PaperDollSlot(x, getY(), sz, PAPERDOLL_HELMET, this)
        ct.add(lblSlotHead)
        ct.inventory_slots.push(lblSlotHead)
        this.paperdoll.push(lblSlotHead)

        const lblSlotChest = new PaperDollSlot(x, getY(), sz, PAPERDOLL_CHESTPLATE, this)
        ct.add(lblSlotChest)
        ct.inventory_slots.push(lblSlotChest)
        this.paperdoll.push(lblSlotChest)

        const lblSlotLeggs = new PaperDollSlot(x, getY(), sz, PAPERDOLL_LEGGINGS, this)
        ct.add(lblSlotLeggs)
        ct.inventory_slots.push(lblSlotLeggs)
        this.paperdoll.push(lblSlotLeggs)

        const lblSlotBoots = new PaperDollSlot(x, getY(), sz, PAPERDOLL_BOOTS, this)
        ct.add(lblSlotBoots)
        ct.inventory_slots.push(lblSlotBoots)
        this.paperdoll.push(lblSlotBoots)
    }

    createRightPaperDoll(sz : float) {
        const ct = this
        const x = this.lblPlayerBox.x + this.lblPlayerBox.w + UI_THEME.window_padding * this.zoom

        let y = 16 * this.zoom

        const getY = () => {
            const resp = y
            y += sz + UI_THEME.slot_margin * this.zoom
            return resp
        }
        
        const lblSlotBackPack = new PaperDollSlot(x, getY(), sz, PAPERDOLL_BACKPACK, this)
        ct.add(lblSlotBackPack)
        ct.inventory_slots.push(lblSlotBackPack)
        this.paperdoll.push(lblSlotBackPack)

        const lblSlotToolBelt = new PaperDollSlot(x, getY(), sz, PAPERDOLL_TOOLBELT, this)
        ct.add(lblSlotToolBelt)
        ct.inventory_slots.push(lblSlotToolBelt)
        this.paperdoll.push(lblSlotToolBelt)

        const lblSlotFakeOne = new Label(x, getY(), sz, sz, 'fake_labl_slot_one')
        lblSlotFakeOne.setBackground(this.hud_atlas.getSpriteFromMap('window_slot_locked'))
        ct.add(lblSlotFakeOne)

        const lblSlotFakeTwo = new Label(x, getY(), sz, sz, 'fake_labl_slot_two')
        lblSlotFakeTwo.setBackground(this.hud_atlas.getSpriteFromMap('window_slot_locked'))
        ct.add(lblSlotFakeTwo)
    }

}