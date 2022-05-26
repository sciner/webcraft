import {Window, Label, Button} from "../../tools/gui/wm.js";
import { Lang } from "../lang.js";

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
        ct.hide();

        //
        let lbl2 = new Label(0, 0, this.width, 30 * this.zoom, 'lbl2', Lang.menu);
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
        this.addStatsButton();
        this.addCloseButton();

    }

    // Return
    addReturnButton() {
        let btnReturn = this.btnReturn = new Button(20 * this.zoom, 80 * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, 'btnReturn', Lang.btn_return);
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

    // Close
    addCloseButton() {
        // Close button
        let btnClose = this.btnClose = new Button(20 * this.zoom, 180 * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, 'btnClose', Lang.btn_exit);
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

    // Statistics
    addStatsButton() {
        let btnStats = this.btnStats = new Button(20 * this.zoom, 130 * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, 'btnStats', Lang.btn_statistics);
        btnStats.style.background.color = '#777777ff';
        btnStats.style.color = '#ffffffff';
        btnStats.style.font.shadow = {
            enable: true,
            x: 2 * this.zoom,
            y: 2 * this.zoom,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.5)'
        }
        btnStats.onMouseDown = function(e) {
            Game.hud.wm.closeAll();
            Game.hud.wm.getWindow('frmStats').show();
        }
        btnStats.onMouseEnter = function() {
            this.style.background.color = '#8892c9';
            this.style.background.image_save = this.style.background.image;
            this.style.background.image = null;
        }
        btnStats.onMouseLeave = function() {
            this.style.background.color = '#777777ff';
            this.style.background.image = this.style.background.image_save;
            this.style.background.image_save = null;
        }
        this.add(btnStats);
    }

}