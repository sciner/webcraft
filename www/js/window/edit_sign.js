import {Button, Label, TextEdit, Window} from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { BlankWindow } from "./blank.js";

export class EditSignWindow extends BlankWindow {

    constructor() {

        super(10, 10, 236, 192, 'frmEditSign', null, null);

        this.zoom *= 1.5;

        this.w *= this.zoom;
        this.h *= this.zoom;

        // Get window by ID
        const ct = this
        ct.style.background.image_size_mode = 'stretch'
        ct.setBackground('./media/gui/form-empty.png')

        // Add labels to window
        let lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 120 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Edit sign text')
        this.add(lbl1)

        // Text editors
        const margin            = 14; // (this.w / this.zoom) / 48 * 2;
        const textEditWidth     = 200 * this.zoom;
        const textEditHeight    = textEditWidth / 2;
        const txtEdit1 = this.txtEdit1 = new TextEdit(this.w / 2 - textEditWidth / 2, 40 * this.zoom, textEditWidth, textEditHeight, 'txtEdit1', null, 'Hello, World!');
        txtEdit1.word_wrap          = true;
        txtEdit1.style.color        = '#ffffff';
        txtEdit1.focused            = true;
        txtEdit1.max_length         = 100;
        txtEdit1.max_lines          = 5;
        txtEdit1.max_chars_per_line = 20;
        txtEdit1.style.background.image_size_mode = 'stretch';
        txtEdit1.setBackground('./media/gui/edit_sign_oak.png');
        this.add(txtEdit1)

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const that = this
            const btnClose = new Button(that.w - this.cell_size, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial'
            btnClose.style.background.image_size_mode = 'stretch'
            btnClose.style.background.image = image
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                that.hide()
            }
            btnClose.onMouseLeave = function() {
                this.style.background.color = '#c6c6c6'
                this.style.color = '#3f3f3f'
            }
            that.add(btnClose)
        });

        // Save button
        const btnHeight = margin * 1.5;
        const btnSave = new Button(ct.width * .5 - 50 * this.zoom, this.height - (btnHeight + margin) * this.zoom, 100 * this.zoom, btnHeight * this.zoom, 'btnSave', 'Save');
        btnSave.onDrop = btnSave.onMouseDown = function(e) {
            ct.hide()
        }
        btnSave.onMouseLeave = function() {
            this.style.background.color = '#c6c6c6'
            this.style.color = '#3f3f3f'
        }
        this.add(btnSave)

    }

    // Обработчик открытия формы
    onShow(args) {
        this.args = args
        this.txtEdit1.buffer = []
        Qubatch.releaseMousePointer()
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