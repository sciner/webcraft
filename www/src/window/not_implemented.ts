import { Button, Label } from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";

export class NotImplementedWindow extends BlankWindow {
    [key: string]: any;

    constructor() {

        super(10, 10, 236, 192, 'frmNotImplemented', null, null);

        this.zoom = UI_ZOOM  * Qubatch.settings.window_size / 100
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom
        this.setBackground('./media/gui/form-empty.png')

        // Add labels to window
        const lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 170 * this.zoom, 30 * this.zoom, 'lbl1', null, Lang.not_implemented);
        this.add(lbl1)

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

    // Обработчик открытия формы
    onShow(args) {
        // this.args = args
        Qubatch.releaseMousePointer()
        super.onShow(args)
    }

    // Request slots
    load(info) {
        this.show()
    }

}