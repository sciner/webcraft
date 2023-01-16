import {Button, Label, Window} from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";

export class NotImplementedWindow extends Window {

    constructor() {

        super(10, 10, 236, 192, 'frmNotImplemented', null, null);

        this.w *= this.zoom;
        this.h *= this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.style.background.image_size_mode = 'stretch';
        ct.setBackground('./media/gui/form-empty.png');
        ct.hide();

        // Add labels to window
        let lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 170 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Not implemented');
        ct.add(lbl1);

        // Обработчик открытия формы
        this.onShow = (args) => {
            this.args = args;
            Qubatch.releaseMousePointer();
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

    }

    // Request slots
    load(info) {
        this.show();
    }

}