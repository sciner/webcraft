import {Button, Label, Window} from "../../tools/gui/wm.js";

export class EditSignWindow extends Window {

    constructor(x, y, w, h, id, title, text) {

        super(x, y, w, h, id, title, text);

        this.width *= this.zoom;
        this.height *= this.zoom;
        this.style.background.image_size_mode = 'stretch';

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/edit_sign_oak.png');
        ct.hide();
        
        // Обработчик открытия формы
        this.onShow = function() {
            Game.releaseMousePointer();
        }

        // Обработчик закрытия формы
        //this.onHide = function() {
        //}

        // Add labels to window
        let lbl1 = new Label(194 * this.zoom, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Create');
        ct.add(lbl1);

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            let btnClose = new Button(ct.width - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image = image;
            // btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                ct.hide();
            }
            ct.add(btnClose);
        });

    }

}