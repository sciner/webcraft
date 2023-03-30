import { Button, Label } from "../ui/wm.js";
import { ArmorSlot, BaseCraftWindow } from "./base_craft_window.js";
import { Lang } from "../lang.js";
import { INVENTORY_HOTBAR_SLOT_COUNT, UI_THEME } from "../constant.js";
import { skinview3d } from "../../vendors/skinview3d.bundle.js"
// import { SpriteAtlas } from "../core/sprite_atlas.js";
import { blobToImage } from "../helpers.js";
import type { InventoryRecipeWindow } from "./inventory_recipe.js";
import type { PlayerInventory } from "../player_inventory.js";
import type { InGameMain } from "./ingamemain.js";
import type { Player } from "../player.js";
import { Resources } from "../resources.js";

// const PLAYER_BOX_WIDTH = 409 / 2;
// const PLAYER_BOX_HEIGHT = 620 / 4;

export class CharacterWindow extends BaseCraftWindow { // BlankWindow {

    frmInventoryRecipe : InventoryRecipeWindow

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

        // Создания слота для армора
        this.createArmorSlots(this.cell_size)

        //
        this.addPlayerBox()

        // Add label
        const lblBackpackWidth = (slots_width - UI_THEME.window_padding) * this.zoom
        const lblBackpackHeight = 30 * this.zoom
        this.addLabel(x * this.zoom, UI_THEME.window_padding * this.zoom, lblBackpackWidth, lblBackpackHeight, Lang.backpack)

    }

    // Обработчик открытия формы
    onShow(args) {
        this.previewSkin()
        super.onShow(args)
    }

    // Обработчик закрытия формы
    onHide() {
        // Drag
        this.inventory.clearDragItem(true)
        // Update player mob model
        this.inventory.player.updateArmor()
        // Save inventory
        this.world.server.InventoryNewState({ state: this.inventory.exportItems() })
        if(this.skinViewer) {
            this.skinViewer.renderPaused = true
        }
    }

    async previewSkin() {

        const drawOneFrame = () => {
            this.skinViewer.draw();
            this.skinViewer.renderPaused = true;
            this.skinViewerCanvas.toBlob(async blob => {
                this.lblPlayerBox.setIcon(await blobToImage(blob), 'centerstretch', .9)
            })
        }

        if (!this.skinViewer) {
            const animation = new skinview3d.WalkingAnimation();
            animation.progress = 0.7;
            animation.paused = true;
            const skinViewer = new skinview3d.SkinViewer({
                canvas: this.skinViewerCanvas,
                width: this.skinViewerCanvas.width,
                height: this.skinViewerCanvas.height,
                animation: null
            });
            skinViewer.camera.position.x = 20;
            skinViewer.camera.position.y = 15;
            skinViewer.camera.position.z = 40;
            skinViewer.zoom = 1;
            skinViewer.fov = 30;
            skinViewer.renderPaused = true;
            this.skinViewer = skinViewer;
        }
        // set or reset the pose
        this.skinViewer.animation = null;
        const s = this.skinViewer.playerObject.skin;
        s.leftArm.rotation.x = -0.2;
        s.rightArm.rotation.x = 0.2;
        s.leftLeg.rotation.x = 0.3;
        s.rightLeg.rotation.x = -0.3;

        const skin = Qubatch.render.player.skin

        if(skin) {
            const skinKey = skin.file + '_' + skin.type;
            if (this.skinKey !== skinKey) {
                this.skinKey = skinKey;
                const model = skin.type ? 'slim' : 'default';
                // use the cached skin image, if available
                const img = Qubatch.world.players.getMyself()?.skinImage;
                // it doesn't return a promise when an image is supplied
                this.skinViewer.loadSkin(img || skin.file, {model})?.then(() => drawOneFrame());
                if (img) {
                    drawOneFrame();
                }
            } else {
                drawOneFrame();
            }
        }

    }

    addPlayerBox() {
        const ct = this;

        const sprite_character_back = this.hud_atlas.getSpriteFromMap('char_back')
        const armor_slot = this.armor_slots[0]
        const margin = UI_THEME.slot_margin * this.zoom

        const PLAYER_BOX_HEIGHT = (this.cell_size + margin) * 4 - margin
        const PLAYER_BOX_WIDTH = PLAYER_BOX_HEIGHT * (sprite_character_back.width / sprite_character_back.height)

        this.lblPlayerBox = new Label(armor_slot.x + armor_slot.w + margin, armor_slot.y, PLAYER_BOX_WIDTH, PLAYER_BOX_HEIGHT, 'lblPlayerBox', null, null)
        this.lblPlayerBox.setBackground(sprite_character_back)

        // Add locked armor slots
        for(let lbl of ct.inventory_slots) {
            if(lbl instanceof ArmorSlot) {
                const x = this.lblPlayerBox.x + this.lblPlayerBox.w + margin
                const l = new Label(x, lbl.y, lbl.w, lbl.w, `${lbl.id}_fake`)
                l.setBackground(this.hud_atlas.getSpriteFromMap('window_slot_locked'))
                ct.add(l)
            }
        }

        this.skinViewerCanvas = document.createElement('canvas')
        this.skinViewerCanvas.width = PLAYER_BOX_WIDTH
        this.skinViewerCanvas.height = PLAYER_BOX_HEIGHT
        // this.lblPlayerBox.setBackground(this.skinViewerCanvas, 'centerstretch', .9);
        this.lblPlayerBox.onMouseDown = () => {
            this.skinViewer.animation = this.skinViewer.animation || new skinview3d.WalkingAnimation();
            this.skinViewer.renderPaused = !this.skinViewer.renderPaused;
        }
        ct.add(this.lblPlayerBox)
    }

    getSlots() {
        return this.inventory_slots;
    }

    createArmorSlots(sz : float) {

        const ct = this;
        const x = UI_THEME.window_padding * this.zoom

        let y = 16 * this.zoom

        const getY = () => {
            const resp = y
            y += sz + UI_THEME.slot_margin * this.zoom
            return resp
        }

        const lblSlotHead = new ArmorSlot(x, getY(), sz, 39, this)
        ct.add(lblSlotHead)
        ct.inventory_slots.push(lblSlotHead)

        const lblSlotChest = new ArmorSlot(x, getY(), sz, 38, this)
        ct.add(lblSlotChest)
        ct.inventory_slots.push(lblSlotChest)

        const lblSlotLeggs = new ArmorSlot(x, getY(), sz, 37, this)
        ct.add(lblSlotLeggs)
        ct.inventory_slots.push(lblSlotLeggs)

        const lblSlotBoots = new ArmorSlot(x, getY(), sz, 36, this)
        ct.add(lblSlotBoots)
        ct.inventory_slots.push(lblSlotBoots)

        this.armor_slots = [lblSlotHead, lblSlotChest, lblSlotLeggs, lblSlotBoots]

    }

}