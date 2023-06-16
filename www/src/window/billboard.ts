import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";
import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH, UI_THEME } from "../constant.js";
import { Window, Slider} from "../ui/wm.js";
import { Resources } from "../resources.js";


class FileSlot extends Window {
    private file: string
    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
        this.hud_atlas = Resources.atlas.get('hud')
        this.setIcon(this.hud_atlas.getSpriteFromMap('plus'))
        this.setBackground(this.hud_atlas.getSpriteFromMap('slot_selection'))
    }

    setFile(file) {
        this.file = file
        this.setIcon(file, 'centerstretch', 1.0)
        this.setBackground(this.hud_atlas.getSpriteFromMap('window_slot'))
    }

    getFile() {
        return this.file.replace('_', '')
    }
}


class FilesCollection extends Window {
    slots : FileSlot[] = []
    xcnt : int = 0
    ycnt : int = 13

    //
    constructor(x : int, y : int, w : int, h : int, id : string, xcnt : int, ycnt : int, slot_margin: float, parent: Window) {

        super(x, y, w, h, id)

        this.untypedParent = parent

        this.xcnt   = xcnt
        this.ycnt   = ycnt

        this.max_height                 = 0
        this.slots_count                = 0
        this.style.background.color     = '#00000000'
        this.style.border.hidden        = true

        this.container = new Window(0, 0, this.w - 22 * this.zoom, this.h, this.id + '_container')
        this.add(this.container)

        // Ширина / высота слота
        this.cell_size = Math.ceil(this.container.w / this.xcnt) - slot_margin
        this.slot_margin = slot_margin

        this.scrollbar = new Slider((this.w - 22 * this.zoom), 0, 22 * this.zoom, this.h, 'scroll')
        this.scrollbar.min = 0
        this.scrollbar.max = this.max_height - this.h
        this.scrollbar.onScroll = (value) => {
            this.updateScroll(-value / this.cell_size)
        }
        this.add(this.scrollbar)
    }

    _wheel(e) {
        const sz    = this.cell_size
        const szm   = sz + this.slot_margin
        this.scrollY += Math.sign(e.original_event.wheelDeltaY) * szm
        this.scrollY = Math.min(this.scrollY, 0)
        this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.h, 0) * -1)
        this.scrollY = Math.round(this.scrollY / szm) * szm
        this.container.y = this.scrollY
        this.scrollbar.value = -this.scrollY
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
        for(let i = 0; i < this.slots_count + 1; i++) {
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

        for(let i = 0; i < all_blocks.length + 1; i++) {

            let lblSlot = this.slots[i]
            if(!lblSlot) {
                lblSlot = this.slots[i] = new FileSlot(0, 0, sz, sz, 'lblFile' + (i), null, null)
                this.container.add(lblSlot)
            }
                
            lblSlot.w = sz
            lblSlot.h = sz
            lblSlot.x = sx + (i % xcnt) * szm
            lblSlot.y = sy + Math.floor(i / xcnt) * szm
            if (i == all_blocks.length) {
                lblSlot.onMouseDown = (e) => {
                    Qubatch.App.OpenSelectFile()
                }
            } else {
                lblSlot.setFile(all_blocks[i])
                lblSlot.onMouseDown = (e) => {
                    parent.sendChangeExtraData(lblSlot.getFile())
                }
            }
            
        }

        this.max_height = Math.ceil((all_blocks.length + 1) / xcnt) * szm - (szm - sz)
        this.container.h = this.max_height
        this.scrollbar.max = this.max_height - this.h

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
        this.addWindowTitle(Lang.displayed_image)
        // Add close button
        this.addCloseButton()
        // Add collection
        this.addCollection()
        // listener
        player.world.server.AddCmdListener([ServerClient.CMD_MEDIA_FILES], (packet) => {
            this.upadateCollection(packet.data.files)
        })
    }

    upadateCollection(files, last = null) {
        this.collection.initCollection(files)
        if (last) {
            this.sendChangeExtraData(last)
        }
    }

    //
    addCollection() {
        if(this.collection) {
            console.error('error_create_collection_slots_already_created')
            return
        }
        this.ycnt = 6 // количество по высоте
        this.xcnt = 5 // количество в ряду
        this.collection = new FilesCollection(this.w / 2, 36 * this.zoom, this.w / 2 - UI_THEME.window_padding * this.zoom, this.h - 75 * this.zoom, 'wCollectionFiles', this.xcnt, this.ycnt, UI_THEME.slot_margin, this)
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

    sendChangeExtraData(file) {
        const extra_data = {
            'relindex': -1,
            'texture': {
                'url': file
            }
        }
        Qubatch.world.changeBlockExtraData(this.args.pos, extra_data)
    }

}