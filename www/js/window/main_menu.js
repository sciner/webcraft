import {Window, Label, Button} from "../../tools/gui/wm.js";
import { Lang } from "../lang.js";

export class MainMenu extends Window {

    constructor(x, y, w, h, id, title, text) {

        w *= UI_ZOOM
        h *= UI_ZOOM

        super(x, y, w, h, id, title, text);
        // this.width = this.w * this.zoom2;
        // this.height = this.h * this.zoom2;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.hide();

        //
        const lbl2 = new Label(0, 0, this.w, 30 * this.zoom2, 'lbl2', Lang.menu);
        lbl2.style.textAlign.horizontal = 'center';
        lbl2.style.textAlign.vertical = 'middle';
        ct.add(lbl2);

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
        super.onShow()
        Qubatch.releaseMousePointer()
    }

    //
    addButton(label, y, onclick) {
        const btnID = `btn_${this.id}_${y}`;
        const btn = new Button(20 * this.zoom, y * this.zoom, this.w - 40 * this.zoom, 40 * this.zoom, btnID, label);
        btn.style.background.color = '#888888ff'
        btn.style.font.color = '#ffffffff'
        btn.style.font.size = 10 * this.zoom
        /*
        btn.style.font.shadow = {
            enable: true,
            x: 2 * this.zoom,
            y: 2 * this.zoom,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.5)'
        }
        */
        btn.onMouseDown = onclick;
        /*
        btn.onMouseEnter = function() {
            this.style.background.color_save = this.style.background.color;
            this.style.background.color = '#8892c9';
            this.style.background.image_save = this.style.background.image;
            this.style.background.image = null;
        }
        btn.onMouseLeave = function() {
            this.style.background.color = this.style.background.color_save;
            this.style.background.image = this.style.background.image_save;
            this.style.background.image_save = null;
            this.style.background.color_save = null;
        }*/
        // btn.style.border.color = '#ff0000';
        this.add(btn);
    }

}