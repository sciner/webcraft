import {Window, Label, Button} from "../../tools/gui/wm.js";

export class DieWindow extends Window {

    zoom = UI_ZOOM;

    constructor(x, y, w, h, id, title, text) {

        super(x, y, w, h, id, title, text);
        this.width *= this.zoom;
        this.height *= this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.hide();
        
        let lbl2 = new Label(20 * this.zoom, 80 * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, 'lbl2', 'Вы мертвы');
        lbl2.style.textAlign.horizontal = 'center';
        lbl2.style.textAlign.vertical = 'middle';
        ct.add(lbl2);
        
        this.addCloseButton();
        
        // onShow
        this.onShow = function() {
            this.parent.center(this);
            Game.releaseMousePointer();
        }
    }
    
    addCloseButton() {
        // Close button
        let btnClose = this.btnClose = new Button(20 * this.zoom, 130 * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, 'btnClose', 'Exit');
        btnClose.style.background.color = '#777777ff';
        btnClose.style.color = '#ffffffff';
        btnClose.style.font.shadow = {
            enable: true,
            x: 2 * this.zoom,
            y: 2 * this.zoom,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.5)'
        }
        btnClose.onMouseDown = function(e) {
            location.reload();
        }
        btnClose.onMouseEnter = function() {
            this.style.background.color = '#8892c9';
            this.style.background.image_save = this.style.background.image;
            this.style.background.image = null;
        }
        btnClose.onMouseLeave = function() {
            this.style.background.color = '#777777ff';
            this.style.background.image = this.style.background.image_save;
            this.style.background.image_save = null;
        }
        this.add(btnClose);
    }
}