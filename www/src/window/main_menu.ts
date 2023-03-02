import { Button, Label } from "../../tools/gui/wm.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";

export class MainMenu extends BlankWindow {
    [key: string]: any;

    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text)
        this.zoom = UI_ZOOM * Qubatch.settings.window_size / 100
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom
        const lblTitle = new Label(0, 0, this.w, 30 * this.zoom, 'lblTitle', null, Lang.menu);
        lblTitle.style.textAlign.horizontal = 'center'
        lblTitle.style.font.size = 16 * this.zoom
        lblTitle.style.textAlign.vertical = 'middle'
        lblTitle.style.font.color = '#ffffff'
        this.add(lblTitle)

        // Add buttons
        this.addButton(Lang.btn_return, 40, () => {
            Qubatch.hud.wm.closeAll()
        });

        this.addButton(Lang.quests, 90, () => {
            Qubatch.hud.wm.closeAll();
            Qubatch.hud.wm.getWindow('frmQuests').toggleVisibility();
        });

        this.addButton(Lang.btn_statistics, 140, () => {
            Qubatch.hud.wm.closeAll();
            Qubatch.hud.wm.getWindow('frmStats').show();
        });
        // [TODO] use callback instead of row readressing
        this.addButton(Lang.btn_exit, 190, () => {
            Qubatch.exit();
        });

    }

    // onShow
    onShow(args) {
        this.parent.center(this)
        Qubatch.releaseMousePointer()
        super.onShow(args)
    }

    //
    addButton(label, y, onclick) {
        const btnID = `btn_${this.id}_${y}`;
        const btn = new Button(20 * this.zoom, y * this.zoom, this.w - 40 * this.zoom, 40 * this.zoom, btnID, label);
        btn.style.background.color = '#d4d0c8'
        btn.style.font.color = '#000000bb'
        btn.style.font.size = 16 * this.zoom
        btn.onMouseDown = onclick
        this.add(btn);
    }

}