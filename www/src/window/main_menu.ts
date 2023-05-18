import { Button, Label } from "../ui/wm.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";

export class MainMenu extends BlankWindow {
    [key: string]: any;

    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text)
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom
        const lblTitle = new Label(0, 0, this.w, 30 * this.zoom, 'lblTitle', null, Lang.menu)
        lblTitle.style.textAlign.horizontal = 'center'
        lblTitle.style.textAlign.vertical = 'middle'
        lblTitle.style.font.color = '#ffffff'
        this.add(lblTitle)

        // Add buttons
        this.addButton(Lang.btn_return, 40, () => {
            Qubatch.hud.wm.closeAll()
        })

        this.addButton(Lang.in_game_main_menu, 90, () => {
            Qubatch.hud.wm.closeAll()
            Qubatch.hud.wm.getWindow('frmInGameMain').openTab('frmInventory')
        })

        // [TODO] use callback instead of row readressing
        this.addButton(Lang.btn_exit, 140, () => {
            Qubatch.exit();
        })

    }

    // onShow
    onShow(args) {
        this.wmParent.center(this)
        Qubatch.releaseMousePointer()
        super.onShow(args)
    }

    //
    addButton(label : string, y : number, onclick : Function) {
        const btnID = `btn_${this.id}_${y}`;
        const btn = new Button(20 * this.zoom, y * this.zoom, this.w - 40 * this.zoom, 40 * this.zoom, btnID, label);
        (btn as any).onMouseDown = onclick
        this.add(btn);
    }

}