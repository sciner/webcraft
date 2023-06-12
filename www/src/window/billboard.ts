import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";
import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH, UI_THEME } from "../constant.js";
import {Button, Label, Window, Slider, SimpleBlockSlot} from "../ui/wm.js";
import { Resources } from "../resources.js";


class FileSlot extends Window {
    private file: string
    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
        this.hud_atlas = Resources.atlas.get('hud')
    }

    setFile(file) {
        this.file = file
        this.setBackground(this.hud_atlas.getSpriteFromMap('window_slot'))
        this.setIcon(file)
    }

    getFile() {
        return this.file
    }
}


class FilesCollection extends Window {
    slots : FileSlot[] = []
    xcnt : int = 0
    ycnt : int = 13

    //
    constructor(x : int, y : int, w : int, h : int, id : string, xcnt : int, ycnt : int, cell_size : float, slot_margin: float, parent: Window) {

        super(x, y, w, h, id)

        this.untypedParent = parent

        // Ширина / высота слота
        this.cell_size = cell_size
        this.slot_margin = slot_margin

        this.xcnt   = xcnt
        this.ycnt   = ycnt

        this.max_height                 = 0
        this.slots_count                = 0
        this.style.background.color     = '#ff000055'
        this.style.border.hidden        = true

        this.container = new Window(0, 0, this.w, this.h, this.id + '_container')
        this.add(this.container)
    }

    _wheel(e) {
        const sz    = this.cell_size
        const szm   = sz + this.slot_margin
        this.scrollY += Math.sign(e.original_event.wheelDeltaY) * szm
        this.scrollY = Math.min(this.scrollY, 0)
        this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.h, 0) * -1)
        this.container.y = this.scrollY
        //this.untypedParent.scrollbar.value = -this.scrollY
        this.updateVisibleSlots()
    }

    updateScroll(val) {
        const sz    = this.cell_size
        const szm   = sz + this.slot_margin
        this.scrollY = val * szm
        this.scrollY = Math.min(this.scrollY, 0)
        this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.h, 0) * -1)
        this.scrollY = Math.round(this.scrollY / szm) * szm
        this.container.y = this.scrollY
        this.updateVisibleSlots()
    }

    updateVisibleSlots() {
        const sz            = this.cell_size
        const szm           = sz + this.slot_margin
        const start_index   = Math.round((-this.scrollY / szm) * this.xcnt)
        const end_index     = start_index + (this.xcnt * this.ycnt)
        for(let i = 0; i < this.slots_count; i++) {
            const child = this.slots[i]
            child.visible = i >= start_index && i < end_index
        }
    }

    // Init collection
    initCollection(all_blocks) {
        this.slots_count        = all_blocks.length
        this.scrollY            = 0
        this.container.y        = 0

        let sx                  = 0
        let sy                  = 0
        let sz                  = this.cell_size
        let szm                 = sz + this.slot_margin
        let xcnt                = this.xcnt
        const parent            = this.untypedParent

        const onMouseDownFunc = function(e) {
            parent.sendChangeExtraData(this.getFile())
            return false
        }

        for(let i = 0; i < all_blocks.length; i++) {

            if(i >= this.slots.length) {
                this.slots.push(null)
            }

            let lblSlot = this.slots[i]
            if(!lblSlot) {
                lblSlot = this.slots[i] = new FileSlot(0, 0, sz, sz, 'lblFile' + (i), null, null)
                lblSlot.onMouseDown = onMouseDownFunc
                this.container.add(lblSlot)
            }
                
            lblSlot.w = sz
            lblSlot.h = sz
            lblSlot.x = sx + (i % xcnt) * szm
            lblSlot.y = sy + Math.floor(i / xcnt) * szm

            lblSlot.setFile(all_blocks[i])
        }

        this.max_height = Math.ceil(all_blocks.length / xcnt) * szm - (szm - sz)
        this.container.h = this.max_height

        this.updateVisibleSlots()

    }
}

export class BillboardWindow extends BlankWindow {

    private collection: FilesCollection

    constructor(player) {

        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmBillboard', null, null)
        this.w *= this.zoom
        this.h *= this.zoom
        // player
        this.player = player
        // Get window by ID
        const ct = this
        ct.setBackground('./media/gui/form-quest.png')

        // Add labels to window
        this.addWindowTitle(Lang.sign_edit)

        // Add close button
        this.addCloseButton()

        // Add collection
        this.addCollection()

        this.addButtonLoad(true, 25, ()=>{
            Qubatch.App.OpenSelectFile()
        })
        
        // listener
        player.world.server.AddCmdListener([ServerClient.CMD_MEDIA_FILES], (packet) => {
            this.collection.initCollection(packet.data.files)
        })

    }

    //
    addCollection() {
        if(this.collection) {
            console.error('error_create_collection_slots_already_created')
            return
        }
        this.ycnt = 4
        this.xcnt = 5 // количество в ряду
        let szm = this.w / (2 * this.xcnt)  // размер ячейки
        szm += (szm - szm / 1.1) / this.xcnt
        const sz = szm / 1.1
        this.cell_size = sz
        this.slot_margin = szm - sz
        this.szm = this.cell_size + this.slot_margin
        this.collection = new FilesCollection(this.w / 2, 45 * this.zoom, this.w / 2, this.h - 50 * this.zoom, 'wCollectionFiles', this.xcnt, this.ycnt, this.cell_size, this.slot_margin, this)
        this.add(this.collection)
        return this.collection
    }

    // Обработчик открытия формы
    onShow(args) {
        this.args = args
        Qubatch.releaseMousePointer()
        super.onShow(args)
        this.player.world.server.Send({name: ServerClient.CMD_MEDIA_FILES})
    }

    // Обработчик открытия формы
    onHide() {
    }

    sendChangeExtraData(file) {
        const extra_data = {
            'relindex': -1,
            'texture': {
                'url': file
            }
        }
        Qubatch.world.changeBlockExtraData(this.args.pos, extra_data)
    }

    private addButtonLoad(alignRight: boolean, dy: number, onMouseDown: () => void): Button {
        const fontScale = 1
        const title = Lang['upload']
        const width = (title.length + 1.5) * 8 * this.zoom * fontScale
        const height = 18 * this.zoom
        const x = alignRight
            ? this.w - width - UI_THEME.window_padding * this.zoom
            : UI_THEME.window_padding * this.zoom
        const y = (dy + UI_THEME.window_padding) * this.zoom
        const btnSort = new Button(x, y, width, height, 'btnSort', title)
        btnSort.z = 1
        btnSort.style.font.size = UI_THEME.button.font.size * fontScale
        btnSort.onMouseDown = () => {
            if (btnSort.enabled) {
                onMouseDown()
            }
        }
        this.add(btnSort)
        return btnSort
    }

}