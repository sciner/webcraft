import {Button, Label, TextEdit, Window} from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";

export class EditSignWindow extends BlankWindow {
    [key: string]: any;

    constructor() {

        super(10, 10, 236, 192, 'frmEditSign', null, null);
        this.zoom = UI_ZOOM * Qubatch.settings.interface_size / 100
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom
        // Get window by ID
        const ct = this
        ct.setBackground('./media/gui/form-empty.png', 'stretch')

        // Add labels to window
        const lblTitle = new Label(17 * this.zoom, 12 * this.zoom, 120 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Edit sign text')
        lblTitle.style.font.size = 10 * this.zoom
        this.add(lblTitle)

        // Text editors
        const margin            = 14 // (this.w / this.zoom) / 48 * 2;
        const textEditWidth     = 200 * this.zoom
        const textEditHeight    = textEditWidth / 2
        const txtEdit1 = this.txtEdit1 = new TextEdit(this.w / 2 - textEditWidth / 2, 40 * this.zoom, textEditWidth, textEditHeight, 'txtEdit1', null, '')
        txtEdit1.word_wrap          = true
        txtEdit1.style.font.color   = '#ffffff'
        txtEdit1.max_length         = 100
        txtEdit1.max_lines          = 5
        txtEdit1.max_chars_per_line = 20
        txtEdit1.style.background.color = '#00000000'
        txtEdit1.setBackground('./media/gui/edit_sign_oak.png', 'stretch')
        this.add(txtEdit1)

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const that = this
            const btnClose = new Button(that.w - this.cell_size, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial'
            btnClose.setBackground(image, 'stretch')
            btnClose.onMouseDown = function(e) {
                that.hide()
            }
            that.add(btnClose)
        });

        // Save button
        const btn_height = margin * 1.5;
        const btnSave = new Button(ct.w * .5 - 50 * this.zoom, this.h - (btn_height + margin) * this.zoom, 100 * this.zoom, btn_height * this.zoom, 'btnSave', Lang.save);
        btnSave.onMouseDown = function(e) {
            ct.hide()
        }
        this.add(btnSave)

    }

    // Обработчик открытия формы
    onShow(args) {
        this.args = args
        this.txtEdit1.text = ''
        Qubatch.releaseMousePointer()
        super.onShow(args)
    }

    // Обработчик открытия формы
    onHide() {
        const pos = this.args.pos;
        const block = Qubatch.world.getBlock(pos)
        if(block.material.tags.includes('sign')) {
            let extra_data = block.extra_data || {}
            const lines = this.txtEdit1.calcPrintLines(this.txtEdit1.buffer.join(''));
            extra_data.text = lines.join("\r")
            Qubatch.world.changeBlockExtraData(pos, extra_data)
        }
    }

}