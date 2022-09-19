import { Window, Label, Button } from "../../tools/gui/wm.js";
import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";

// кнопки эффектов
class ModeButton extends Window {
    
    constructor(x, y, size, id, icon, ct) {
        
        super(x, y, size, size, id, null, null);
        this.icon = 'speed';
        this.ct = ct;
        this.style.background.image = './media/icons.png';
        this.style.border.hidden = true;
        this.style.background.color = '#00000000';
        this.style.background.sprite = {
            'mode': 'stretch',
            'width': 48,
            'height': 48,
            'x': 97,
            'y': 192
        };
        this.setBackground(this.style.background.image, 'sprite');
        this.style.icon.image = './media/icons.png';
        this.style.icon.sprite = {
            'mode': 'stretch',
            'width': 32,
            'height': 32,
            'x': 272,
            'y': 74
        };
        this.setIconImage(this.style.icon.image, 'sprite');
    }
    
    setEnable(val) {
        this.style.background.sprite.x = val ? 46 : 97;
    }
    
    setIcon() {
        //32 32 204 74
        // 68 74
        // 268 40
    }
}

export class ModeWindow extends Window {

    constructor(player) {

        super(10, 10, 352, 332, 'frmMode', null, null);

        this.player = player;
        this.width *= this.zoom;
        this.height *= this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.style.color = '#000000';
        ct.hide();
        
        this.cell_size = 45 * this.zoom;
        this.btn_speed = new ModeButton(50 * this.zoom, 50 * this.zoom, this.cell_size, 'btnSpeed', 'speed', this);
        this.btn_speed.setEnable(true);
        this.add(this.btn_speed);

        // onShow
        this.onShow = function() {
            this.parent.center(this);
            Qubatch.releaseMousePointer();
            console.log(this.player.game_mode)
        }
        
        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            console.log(e)
            switch(keyCode) {
                case KEY.E:
                case KEY.ESC: {
                    if(!down) {
                        ct.hide();
                        try {
                            Qubatch.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    return true;
                }
            }
            return false;
        }
    }

}