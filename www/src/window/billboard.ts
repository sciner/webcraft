import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";
import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH, UI_THEME } from "../constant.js";
import { Window, Slider, Label, Button} from "../ui/wm.js";
import { Resources } from "../resources.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";


class FileSlot extends Window {
    #data: any
    #parent: Window
    constructor(x : number, y : number, w : number, h : number, id : string, parent: Window) {
        super(x, y, w, h, id, null, null)
        this.hud_atlas = Resources.atlas.get('hud')
        this.setIcon(this.hud_atlas.getSpriteFromMap('plus'))
        this.setBackground(this.hud_atlas.getSpriteFromMap('slot_selection'))
        this.#parent = parent
        this.onMouseDown = function() {
            if (this.#data) {
                this.#parent.sendChangeExtraData(this.#data)
            } else {
                Qubatch.App.OpenSelectFileImage((files : File[]) => {
                    if (!files) {
                        return
                    }
                    const reader = new FileReader()
                    reader.onload = function (e) {
                        const img = new Image()
                        img.src = e.target.result.toString()
                        img.onload = () => {
                            // generate preview
                            const MAX_PREVIEW_SIZE = 200
                            const w = Math.round(img.width > img.height ? MAX_PREVIEW_SIZE : img.width / (img.height / MAX_PREVIEW_SIZE))
                            const h = Math.round(img.height > img.width ? MAX_PREVIEW_SIZE : img.height / (img.width / MAX_PREVIEW_SIZE))
                            const canvas_preview = document.createElement('canvas')
                            canvas_preview.width = w
                            canvas_preview.height = h
                            const ctx_preview = canvas_preview.getContext('2d')
                            ctx_preview.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h)
                            canvas_preview.toBlob((previewBlob) => {
                                const form = new FormData()
                                form.append('file', files[0])
                                form.append('preview', new File([previewBlob], 'preview.png', { type: 'image/png' }))
                                Qubatch.App.Billboard(form, function(result) {
                                    if (result.result == 'ok') {
                                        vt.success('Image uploaded to server')
                                        Qubatch.hud.wm.getWindow('frmBillboard').upadateCollection(result.files, result.last)
                                    } else {
                                        vt.error('Error upload image')
                                    }
                                })
                            }, 'image/png')
                        }
                    }
                    reader.readAsDataURL(files[0])
                })
            } 
        }
    }

    setFile(data) {
        this.#data = data
        if (this.#data.demo) {
            this.setIcon(`/media/demo/${this.#data.file}`, 'centerstretch', 1.0)
        } else {
            const id = this.#parent.player.session.user_id
            this.setIcon(`/upload/${id}/${this.#data.file}`, 'centerstretch', 1.0)
            this.addDeleteButton(data)
        }
        this.setBackground(this.hud_atlas.getSpriteFromMap('window_slot'))
    }

    addDeleteButton(data) {
        const height = 32 * this.zoom
        const width = 32 * this.zoom
        const parent = this.#parent
        const btnDel = new Label(this.w - width, 0, height, width, 'btnDel')
        btnDel.setIcon(this.hud_atlas.getSpriteFromMap('trashbin'))
        btnDel.onMouseDown = () => {
            parent.delFile(data)
        }
        this.add(btnDel)
    }
}


class FilesCollection extends Window {
    slots : FileSlot[] = []
    xcnt : int = 0
    ycnt : int = 13
    #parent: Window

    //
    constructor(x : int, y : int, w : int, h : int, id : string, xcnt : int, ycnt : int, slot_margin: float, parent: Window) {

        super(x, y, w, h, id)

        this.#parent = parent

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
        const sz     = this.cell_size
        const szm    = sz + this.slot_margin
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
        this.slots_count        = all_blocks.length + 1
        this.scrollY            = 0
        this.container.y        = 0

        let sx                  = 0
        let sy                  = 0
        let sz                  = this.cell_size
        let szm                 = sz + this.slot_margin
        let xcnt                = this.xcnt
        const parent            = this.#parent

        if (all_blocks.length < this.slots.length) {
            for (let i = 0; i < this.slots.length; i++) {
                this.container.removeChild(this.slots[i])
                this.slots[i] = null
            }
        }

        for(let i = 0; i < this.slots_count; i++) {

            let lblSlot = this.slots[i]
            if(!lblSlot) {
                lblSlot = this.slots[i] = new FileSlot(0, 0, sz, sz, 'lblFile' + (i), parent)
                this.container.add(lblSlot)
            }
                
            lblSlot.w = sz
            lblSlot.h = sz
            lblSlot.x = sx + (i % xcnt) * szm
            lblSlot.y = sy + Math.floor(i / xcnt) * szm

            if (i != all_blocks.length) {
                lblSlot.setFile(all_blocks[i])
            }
            
        }

        this.max_height = Math.ceil((this.slots_count) / xcnt) * szm - (szm - sz)
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
        //dialog
        this.addDialog(Lang.delete_file + '?', Lang.lost_file, (data)=> {
            player.world.server.Send({
                name: ServerClient.CMD_BILLBOARD_MEDIA,
                delete: data
            })
        })
        // listener
        player.world.server.AddCmdListener([ServerClient.CMD_BILLBOARD_MEDIA], (packet) => {
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
        this.xcnt = 10 // количество в ряду
        this.collection = new FilesCollection(UI_THEME.window_padding * this.zoom, 36 * this.zoom, this.w - 2 * UI_THEME.window_padding * this.zoom, this.h - 75 * this.zoom, 'wCollectionFiles', this.xcnt, this.ycnt, UI_THEME.slot_margin, this)
        this.add(this.collection)
        return this.collection
    }

    // Обработчик открытия формы
    onShow(args) {
        this.args = args
        Qubatch.releaseMousePointer()
        super.onShow(args)
        this.player.world.server.Send({name: ServerClient.CMD_BILLBOARD_MEDIA})
    }

    sendChangeExtraData(data) {
        Qubatch.world.changeBlockExtraData(this.args.pos, data)
    }

    delFile(data) {
        this.confirm.data = data
        this.confirm.show()
    }

    /**
     * Создать диалоговое окно подтверждения действия
     */
    protected addDialog(title_text:string, body_text: string, callback): void {
        const hh = 13
        const width = 342
        const height = 190
        const form_atlas = new SpriteAtlas()
        const confirm = this.confirm = new Window((this.w - width * this.zoom) / 2, (this.h - height * this.zoom) / 2, width * this.zoom, height * this.zoom, 'confirm_delete')
        form_atlas.fromFile('./media/gui/popup.png').then(async (atlas : SpriteAtlas) => {
            confirm.setBackground(await atlas.getSprite(0, 0, 1008, 573), 'none', this.zoom / 2.0)
        })
        confirm.z = 1
        confirm.hide()
        this.add(confirm)

        const title = new Label(38 * this.zoom, 25 * this.zoom, 0, 0, `lblConfirmTitle`, '', title_text)
        title.style.font.size = UI_THEME.popup.title.font.size
        title.style.font.color = UI_THEME.popup.title.font.color
        confirm.add(title)

        const text = new Label(38 * this.zoom, 70 * this.zoom, 0, 0, `lblConfirmText`, '', body_text)
        text.style.font.size = UI_THEME.popup.text.font.size
        text.style.font.color = UI_THEME.popup.text.font.color
        confirm.add(text)

        const descr = new Label(38 * this.zoom, 86 * this.zoom, 0, 0, `lblConfirmDescr`, '', Lang.lost_file_2)
        descr.style.font.size = UI_THEME.popup.text.font.size
        descr.style.font.color = UI_THEME.popup.text.font.color
        confirm.add(descr)

        const btnYes = new Button(38 * this.zoom, 119 * this.zoom, 92 * this.zoom, 30 * this.zoom, 'btnOK', Lang.yes)
        btnYes.onDrop = btnYes.onMouseDown = function() {
            callback(confirm.data)
            confirm.hide()
        }
        this.confirm.add(btnYes)

        const btnNo = new Button(151 * this.zoom, 119 * this.zoom, 92 * this.zoom, 30 * this.zoom, 'btnNo', Lang.no)
        btnNo.onMouseDown = function() {
            confirm.hide()
        }
        confirm.add(btnNo)
    }

}