import { Component } from "./wm.js";



export class ModeWindow extends Component {

    constructor(player) {
        super(0, 0, 217, 100, 'frmMode');
        
    }
    

}

/*import { Window, Label, Button } from "../../tools/gui/wm.js";
import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";

class ModeLabel extends Window {
    
    constructor(x, y, size, id, icon, ct) {
        
        super(x, y, size, size, id, null, null);
        this.ct = ct;
        this.style.background.image = './media/icons.png';
        this.style.border.hidden = true;
        this.style.background.color = '#00000000';
        this.style.background.sprite = {
            'mode': 'stretch',
            'width': 48,
            'height': 48,
            'x': 47,
            'y': 193
        };
        this.setBackground(this.style.background.image, 'sprite');
        this.style.icon.image = './media/icons.png';
        this.style.icon.sprite = {
            'mode': 'none',
            'width': 32,
            'height': 32,
            'x': 272,
            'y': 74
        };
        this.setIconImage(this.style.icon.image, 'sprite');
        
        this.setIcon(icon);
    }
    
    setSelect(val) {
        this.style.background.sprite.x = val ? 97 : 47;
    }
    
    setIcon(val) {
        switch (val) {
            case 'survival': {
                this.style.icon.sprite.x = 204;
                this.style.icon.sprite.y = 74;
                break;
            }
            case 'spectator': {
                this.style.icon.sprite.x = 68;
                this.style.icon.sprite.y = 74;
                break;
            }
            case 'creative': {
                this.style.icon.sprite.x = 268;
                this.style.icon.sprite.y = 40;
                break;
            }
            case 'adventure': {
                this.style.icon.sprite.x = 272;
                this.style.icon.sprite.y = 74;
                break;
            }
        }
    }
}

export class ModeWindow extends Window {

    constructor(player) {

        super(10, 10, 217, 100, 'frmMode', null, null);
        
        this.mode = 'survival';
        this.player = player;
        this.width *= this.zoom;
        this.height *= this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = false;
        ct.style.color = '#000000';
        ct.hide();
        
        this.lbl_survival = new ModeLabel(5 * this.zoom, 5 * this.zoom, 48 * this.zoom, 'lblSurvival', 'survival', this);
        this.lbl_creative = new ModeLabel(58 * this.zoom, 5 * this.zoom, 48 * this.zoom, 'lblCreative', 'creative', this);
        this.lbl_adventure = new ModeLabel(111 * this.zoom, 5 * this.zoom, 48 * this.zoom, 'lblAdventure', 'adventure', this);
        this.lbl_spectator = new ModeLabel(164 * this.zoom, 5 * this.zoom, 48 * this.zoom, 'lblSpectator', 'spectator', this);
        this.add(this.lbl_survival);
        this.add(this.lbl_creative);
        this.add(this.lbl_adventure);
        this.add(this.lbl_spectator);

        // onShow
        this.onShow = function() {
            this.parent.center(this);
            Qubatch.releaseMousePointer();
            this.mode = this.player.game_mode.current.id;
            this.updateMode();
        }
        
        // Обработчик закрытия формы
        this.onHide = function() {
            player.world.server.Send({
                name: ServerClient.CMD_GAMEMODE_SET, 
                data: {
                    id: this.mode
                }
            });
        }
        
        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.F4: {
                    if(!down) {
                        if (this.mode == 'survival') {
                            this.mode = 'creative';
                        } else if (this.mode == 'creative') {
                            this.mode = 'adventure';
                        } else if (this.mode == 'adventure') {
                            this.mode = 'spectator';
                        } else { 
                            this.mode = 'survival';
                        }
                        this.updateMode();
                    }
                    return true;
                }
            }
            return false;
        }
    }
    
    updateMode() {
        this.lbl_survival.setSelect(false);
        this.lbl_creative.setSelect(false);
        this.lbl_adventure.setSelect(false);
        this.lbl_spectator.setSelect(false);
        switch(this.mode) {
            case 'survival': this.lbl_survival.setSelect(true); break;
            case 'creative': this.lbl_creative.setSelect(true); break;
            case 'adventure': this.lbl_adventure.setSelect(true); break;
            case 'spectator': this.lbl_spectator.setSelect(true); break;
        }
    }

}*/