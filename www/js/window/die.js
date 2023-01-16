import {Window, Label, Button} from "../../tools/gui/wm.js";
import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";

export class DieWindow extends Window {

    constructor() {

        super(10, 10, 352, 332, 'frmDie', null, null);

        this.w *= this.zoom;
        this.h *= this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.hide();
        
        let lbl2 = new Label(20 * this.zoom, 50 * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, 'lbl2', Lang.you_died);
        lbl2.style.textAlign.horizontal = 'center';
        lbl2.style.textAlign.vertical = 'middle';
        lbl2.style.font.size = 50;
        lbl2.style.color = '#fff';
        ct.add(lbl2);

        this.addReturnButton()
        this.addCloseButton();
        
        // onShow
        this.onShow = function() {
            this.parent.center(this);
            Qubatch.releaseMousePointer();
        }
    }

    get zoom() {
        return UI_ZOOM;
    }

    addCloseButton() {
        // Close button
        let btnClose = this.btnClose = new Button(20 * this.zoom, 150 * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, 'btnClose', Lang.btn_exit);
        btnClose.style.background.color = '#777777ff';
        btnClose.style.color = '#ffffffff';
        btnClose.style.font.shadow = {
            enable: true,
            x: 2 * this.zoom,
            y: 2 * this.zoom,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.5)'
        }
        btnClose.onMouseDown = function (e) {
            Qubatch.exit();
        }
        btnClose.onMouseEnter = function () {
            this.style.background.color = '#8892c9';
            this.style.background.image_save = this.style.background.image;
            this.style.background.image = null;
        }
        btnClose.onMouseLeave = function () {
            this.style.background.color = '#777777ff';
            this.style.background.image = this.style.background.image_save;
            this.style.background.image_save = null;
        }
        this.add(btnClose);
    }

    addReturnButton() {
        let btnReturn = this.btnReturn = new Button(20 * this.zoom, 100 * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, 'btnReturn', Lang.btn_return);
        btnReturn.style.background.color = '#777777ff';
        btnReturn.style.color = '#ffffffff';
        btnReturn.style.font.shadow = {
            enable: true,
            x: 2 * this.zoom,
            y: 2 * this.zoom,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.5)'
        }
        btnReturn.onMouseDown = function (e) {
            Qubatch.hud.wm.closeAll();
            Qubatch.player.world.server.Send({ name: ServerClient.CMD_RESURRECTION });
        }
        btnReturn.onMouseEnter = function () {
            this.style.background.color = '#8892c9';
            this.style.background.image_save = this.style.background.image;
            this.style.background.image = null;
        }
        btnReturn.onMouseLeave = function () {
            this.style.background.color = '#777777ff';
            this.style.background.image = this.style.background.image_save;
            this.style.background.image_save = null;
        }
        this.add(btnReturn);
    }
    
}