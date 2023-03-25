import { Label, Button } from "../ui/wm.js";
import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";

export class DieWindow extends BlankWindow {

    constructor() {
        super(0, 0, 352, 332, 'frmDie')
        this.w *= this.zoom
        this.h *= this.zoom
        const lblTitle = new Label(20 * this.zoom, 50 * this.zoom, this.w - 40 * this.zoom, 40 * this.zoom, 'lblTitle', null, Lang.you_died)
        lblTitle.style.textAlign.horizontal = 'center'
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

    // Exit button
    addCloseButton() {
        const btnClose = this.btnClose = new Button(20 * this.zoom, 150 * this.zoom, this.w - 40 * this.zoom, 40 * this.zoom, 'btnClose', Lang.btn_exit)
        btnClose.onMouseDown = function (e) {
            Qubatch.exit();
        }
        this.add(btnClose);
    }

    addReturnButton() {
        const btnReturn = this.btnReturn = new Button(20 * this.zoom, 100 * this.zoom, this.w - 40 * this.zoom, 40 * this.zoom, 'btnReturn', Lang.btn_return)
        btnReturn.onMouseDown = (e) => {
            this.getRoot().closeAll();
            Qubatch.player.world.server.Send({ name: ServerClient.CMD_RESURRECTION });
        }
        this.add(btnReturn);
    }

}