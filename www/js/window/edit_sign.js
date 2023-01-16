import {Button, Label, TextEdit, Window} from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";

export class EditSignWindow extends Window {

    constructor() {

        super(10, 10, 236, 192, 'frmEditSign', null, null);

        this.zoom *= 1.5;

        this.w *= this.zoom;
        this.h *= this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.style.background.image_size_mode = 'stretch';
        ct.setBackground('./media/gui/form-empty.png');
        ct.hide();

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.ESC: {
                    if(!down) {
                        ct.hide();
                        try {
                            Qubatch.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    return true;
                }
            }
            return false;
        }

        // Add labels to window
        let lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 120 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Edit sign text');
        ct.add(lbl1);

        // Text editors
        const margin            = 14; // (this.width / this.zoom) / 48 * 2;
        const textEditWidth     = 200 * this.zoom;
        const textEditHeight    = textEditWidth / 2;
        const txtEdit1 = new TextEdit(this.width / 2 - textEditWidth / 2, 40 * this.zoom, textEditWidth, textEditHeight, 'txtEdit1', null, 'Hello, World!');
        txtEdit1.word_wrap          = true;
        txtEdit1.style.color        = '#ffffff';
        txtEdit1.focused            = true;
        txtEdit1.max_length         = 100;
        txtEdit1.max_lines          = 5;
        txtEdit1.max_chars_per_line = 20;
        txtEdit1.style.font.size    *= this.zoom;
        txtEdit1.style.background.image_size_mode = 'stretch';
        txtEdit1.setBackground('./media/gui/edit_sign_oak.png');
        ct.add(txtEdit1);

        // Обработчик открытия формы
        this.onShow = (args) => {
            this.args = args;
            txtEdit1.buffer = [];
            Qubatch.releaseMousePointer();
        }

        // Обработчик открытия формы
        this.onHide = () => {
            const pos = this.args.pos;
            const block = Qubatch.world.getBlock(pos);
            if(block.material.tags.includes('sign')) {
                let extra_data = block.extra_data || {};
                const lines = txtEdit1.calcPrintLines(txtEdit1.buffer.join(''));
                extra_data.text = lines.join("\r");
                Qubatch.world.changeBlockExtraData(pos, extra_data);
            }
        }

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            let btnClose = new Button(ct.width - this.cell_size, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image_size_mode = 'stretch';
            btnClose.style.background.image = image;
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                ct.hide();
            }
            btnClose.onMouseLeave = function() {
                this.style.background.color = '#c6c6c6';
                this.style.color = '#3f3f3f';
            }
            ct.add(btnClose);
        });

        // Save button
        const btnHeight = margin * 1.5;
        let btnSave = new Button(ct.width * .5 - 50 * this.zoom, this.height - (btnHeight + margin) * this.zoom, 100 * this.zoom, btnHeight * this.zoom, 'btnSave', 'Save');
        btnSave.onDrop = btnSave.onMouseDown = function(e) {
            ct.hide();
        }
        btnSave.onMouseLeave = function() {
            this.style.background.color = '#c6c6c6';
            this.style.color = '#3f3f3f';
        }
        ct.add(btnSave);

    }

}