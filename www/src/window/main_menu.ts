import { Button, Label } from "../../tools/gui/wm.js";
import { Lang } from "../lang.js";
import { BlankWindow } from "./blank.js";

export class MainMenu extends BlankWindow {
    [key: string]: any;

    constructor(x, y, w, h, id, title, text) {

        super(x, y, w * UI_ZOOM, h * UI_ZOOM, id, title, text)

        //
        const lbl2 = new Label(0, 0, this.w, 30 * this.zoom, 'lbl2', Lang.menu);
        lbl2.style.textAlign.horizontal = 'center';
        lbl2.style.textAlign.vertical = 'middle';
        this.add(lbl2);

        // Add buttons
        this.addButton(Lang.btn_return, 80, () => {Qubatch.hud.wm.closeAll()});

        this.addButton(Lang.quests, 130, () => {
            Qubatch.hud.wm.closeAll();
            Qubatch.hud.wm.getWindow('frmQuests').toggleVisibility();
        });

        this.addButton(Lang.btn_statistics, 180, () => {
            Qubatch.hud.wm.closeAll();
            Qubatch.hud.wm.getWindow('frmStats').show();
        });
        // [TODO] use callback instead of row readressing
        this.addButton(Lang.btn_exit, 230, () => {
            Qubatch.exit();
        });

    }

    // onShow
    onShow() {
        this.parent.center(this)
        Qubatch.releaseMousePointer()
        super.onShow()
    }

    //
    addButton(label, y, onclick) {
        const btnID = `btn_${this.id}_${y}`;
        const btn = new Button(20 * this.zoom, y * this.zoom, this.w - 40 * this.zoom, 40 * this.zoom, btnID, label);
        btn.style.background.color = '#d4d0c8'
        btn.style.font.color = '#000000bb'
        btn.style.font.size = 20
        btn.onMouseDown = onclick
        this.add(btn);
    }

}