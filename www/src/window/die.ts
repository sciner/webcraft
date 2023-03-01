import { Label, Button } from "../../tools/gui/wm.js";
import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";

export class DieWindow extends BlankWindow {
    [key: string]: any;

    constructor() {
        super(10, 10, 352, 332, 'frmDie')

        this.zoom = UI_ZOOM  * Qubatch.settings.window_size / 100
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom

        const lblTitle = new Label(20 * this.zoom, 50 * this.zoom, this.w - 40 * this.zoom, 40 * this.zoom, 'lblTitle', null, Lang.you_died)
        lblTitle.style.textAlign.horizontal = 'center'
        lblTitle.style.font.size = 16 * this.zoom
        lblTitle.style.font.color = '#ffffff'
        this.add(lblTitle)

        this.addReturnButton()
        this.addCloseButton()

    }

    // onShow
    onShow(args) {
        this.getRoot().center(this)
        Qubatch.releaseMousePointer()
        super.onShow(args)
    }

    addCloseButton() {
        // Close button
        const btnClose = this.btnClose = new Button(20 * this.zoom, 150 * this.zoom, this.w - 40 * this.zoom, 40 * this.zoom, 'btnClose', Lang.btn_exit)
        btnClose.style.background.color = '#888888ff'
        btnClose.style.font.color = '#ffffffff'
        btnClose.style.font.size = 16 * this.zoom
        /*
        btnClose.style.font.shadow = {
            enable: true,
            x: 2 * this.zoom,
            y: 2 * this.zoom,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.5)'
        }
        */
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
        const btnReturn = this.btnReturn = new Button(20 * this.zoom, 100 * this.zoom, this.w - 40 * this.zoom, 40 * this.zoom, 'btnReturn', Lang.btn_return)
        btnReturn.style.background.color = '#888888ff'
        btnReturn.style.font.color = '#ffffffff'
        btnReturn.style.font.size = 16 * this.zoom
        /*
        btnReturn.style.font.shadow = {
            enable: true,
            x: 2 * this.zoom,
            y: 2 * this.zoom,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.5)'
        }
        */
        btnReturn.onMouseDown = (e) => {
            this.getRoot().closeAll();
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