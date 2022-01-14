import {Window, Label, Button} from "../../tools/gui/wm.js";

export default class MainMenu extends Window {

    zoom = UI_ZOOM;

    constructor(x, y, w, h, id, title, text) {

        super(x, y, w, h, id, title, text);
        this.width *= this.zoom;
        this.height *= this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        // ct.setBackground('./media/gui/form-crafting-table.png');
        ct.hide();
        // Add labels to window
        let lbl1 = new Label(0, 0, this.width, 30 * this.zoom, 'lbl1', 'Menu');
        lbl1.style.color = '#333333ff';
        lbl1.style.textAlign.horizontal = 'center';
        lbl1.style.textAlign.vertical = 'middle';
        ct.add(lbl1);
        //
        let lbl2 = new Label(0, 0, this.width, 30 * this.zoom, 'lbl2', 'Menu');
        lbl2.style.color = '#ffffffff';
        lbl2.style.textAlign.horizontal = 'center';
        lbl2.style.textAlign.vertical = 'middle';
        ct.add(lbl2);

        // onShow
        this.onShow = function() {
            this.parent.center(this);
            Game.releaseMousePointer();
        }

        // Add buttons
        this.addReturnButton();
        this.addCloseButton();
        
        // Load buttons background image
        let image = new Image();
        image.onload = function(e) {
            ct.buttonBackground = this;
            ct.btnReturn.style.background.image = this;
            ct.btnClose.style.background.image = this;
            ct.btnReturn.style.background.image_size_mode = 'stretch';
            ct.btnClose.style.background.image_size_mode = 'stretch';
        }
        image.src = '../../media/gui/button_center.png';

    }

    addReturnButton() {
        let btnReturn = this.btnReturn = new Button(20 * this.zoom, 80 * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, 'btnReturn', 'Return');
        btnReturn.style.background.color = '#777777ff';
        btnReturn.style.color = '#ffffffff';
        btnReturn.style.font.shadow = {
            enable: true,
            x: 2 * this.zoom,
            y: 2 * this.zoom,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.5)'
        }
        btnReturn.onMouseDown = function(e) {
            Game.hud.wm.closeAll();
            // Game.setupMousePointer();
        }
        btnReturn.onMouseEnter = function() {
            this.style.background.color = '#8892c9';
            this.style.background.image_save = this.style.background.image;
            this.style.background.image = null;
        }
        btnReturn.onMouseLeave = function() {
            this.style.background.color = '#777777ff';
            this.style.background.image = this.style.background.image_save;
            this.style.background.image_save = null;
        }
        this.add(btnReturn);
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