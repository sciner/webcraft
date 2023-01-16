import {Window, Label, Button} from "../../tools/gui/wm.js";
import { Lang } from "../lang.js";

export class MainMenu extends Window {

    constructor(x, y, w, h, id, title, text) {

        super(x, y, w, h, id, title, text);
        this.w *= this.zoom;
        this.h *= this.zoom;

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
            Qubatch.releaseMousePointer();
        }

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

    get zoom() {
        return UI_ZOOM;
    }

    //
    addButton(label, y, onclick) {
        const btnID = `btn_${this.id}_${y}`;
        let btn = new Button(20 * this.zoom, y * this.zoom, this.width - 40 * this.zoom, 40 * this.zoom, btnID, label);
        btn.style.background.color = '#777777ff';
        btn.style.color = '#ffffffff';
        btn.style.font.shadow = {
            enable: true,
            x: 2 * this.zoom,
            y: 2 * this.zoom,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.5)'
        }
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