import {Button, TextEdit } from "../ui/wm.js";
import { INVENTORY_SLOT_SIZE, UI_THEME } from "../constant.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";
import type { World } from "./../world.js";
import { ServerClient } from "./../server_client.js";

export class EditSignWindow extends BlankWindow {

    constructor() {

        super(0, 0, 236, 192, 'frmEditSign', null, null)
        this.w *= this.zoom
        this.h *= this.zoom
        // Get window by ID
        const ct = this
        ct.setBackground('./media/gui/form-empty.png', 'stretch')

        // Text editors
        const margin            = 14
        const textEditWidth     = this.w - UI_THEME.window_padding * this.zoom * 2
        const textEditHeight    = textEditWidth / 2
        const txtEdit1 = this.txtEdit1 = new TextEdit(this.w / 2 - textEditWidth / 2, 40 * this.zoom, textEditWidth, textEditHeight, 'txtEdit1', null, '')
        txtEdit1.word_wrap          = true
        txtEdit1.style.font.color   = '#ffffff'
        // txtEdit1.style.font.size    = 16
        txtEdit1.max_length         = 100
        txtEdit1.max_lines          = 5
        txtEdit1.max_chars_per_line = 20
        txtEdit1.style.background.color = '#00000000'
        txtEdit1.setBackground('./media/gui/edit_sign_oak.png', 'stretch')
        txtEdit1.onChange = (text : string) => {
            const pos = this.args.pos;
            const tblock = Qubatch.world.getBlock(pos)
            if(tblock.material.tags.includes('sign')) {
                const extra_data = tblock.extra_data || {}
                const lines = this.txtEdit1.calcPrintLines(this.txtEdit1.buffer.join(''));
                extra_data.text = lines.join("\r")
                const world = Qubatch.world as World
                world.updateLocalBlock(pos, extra_data)
            }
        }
        this.add(txtEdit1)

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Add labels to window
        this.addWindowTitle(Lang.sign_edit)

        // Add close button
        this.addCloseButton()

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
            const extra_data = block.extra_data || {}
            const lines = this.txtEdit1.calcPrintLines(this.txtEdit1.buffer.join(''));
            extra_data.text = lines.join("\r")
            Qubatch.world.changeBlockExtraData(pos, extra_data)
        }
    }

}