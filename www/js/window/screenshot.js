import { Button, Label, Window } from "../../tools/gui/wm.js";
import { Lang } from "../lang.js";
import { Helpers } from "../helpers.js";

export class ScreenshotWindow extends Window {

    constructor(player) {

        super(10, 10, 352, 155, "frmScreenshot", null, null);

        this.width *= this.zoom;
        this.height *= this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.background.image_size_mode = 'stretch';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-empty.png');
        ct.hide();

        // Add labels to window
        ct.add(new Label(17 * this.zoom, 12 * this.zoom, 300 * this.zoom, 30 * this.zoom, 'lbl1', null, "Save screenshot"));

       this.addButton("Save screenshot", 50, () => {
            Qubatch.render.screenshot(false); 
            Qubatch.hud.wm.closeAll();
        });
        
        this.addButton("set world", 100, () => {
            Qubatch.render.screenshot(true);
            Qubatch.hud.wm.closeAll();
        });

        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Qubatch.releaseMousePointer();
        }

        // Обработчик закрытия формы
        this.onHide = function() {}

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            let btnClose = new Button(ct.width - this.cell_size, 12 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image = image;
            btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onMouseDown = function(e) {
                console.log(e);
                ct.hide();
            }
            ct.add(btnClose);
        });

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
    }
    
    addButton(label, y, onclick) {
        const btnID = `btn_${this.id}_${y}`;
        let btn = new Button(20 * this.zoom, y * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, btnID, label);
        btn.style.background.color = '#777777ff';
        btn.style.color = '#ffffffff';
        btn.style.font.shadow = {
            enable: true,
            x: 2 * this.zoom,
            y: 2 * this.zoom,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.5)'
        }
        btn.onMouseDown = onclick;
        this.add(btn);
    }

}