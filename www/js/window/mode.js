import { Component } from "./wm.js";
import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";

export class ModeWindow extends Component {

    constructor(player) {
        super(0, 0, 217, 130, 'frmMode');
        this.setBackgroundColor('00000055');
        
        this.player = player;
        this.mode == 'survival'
        
        this.add(new Component(0, 90, 217, 43, 'lblHelp', '[ F4 ] - Дальше', this));
        
        this.title = new Component(0, 0, 217, 43, 'lblTitle', 'Test', this);
        this.title.setBackground('toasts-0.png');
        this.add(this.title);
        
        this.lbl_survival = new Component(5, 48, 48, 48, 'lblSurvival', null, this);
        this.lbl_survival.setBackground('inventory-0.png');
        this.lbl_survival.setIcon('iron_sword.png', 20);
        this.add(this.lbl_survival);
        
        this.lbl_creative = new Component(58, 48, 48, 48, 'lblCreative', null, this);
        this.lbl_creative.setBackground('inventory-0.png');
        this.lbl_creative.setIcon('brick.png', 20);
        this.add(this.lbl_creative);
        
        this.lbl_adventure = new Component(111, 48, 48, 48, 'lblAdventure', null, this);
        this.lbl_adventure.setBackground('inventory-0.png');
        this.lbl_adventure.setIcon('map.png', 20);
        this.add(this.lbl_adventure);
        
        this.lbl_spectator = new Component(164, 48, 48, 48, 'lblSpectator', null, this);
        this.lbl_spectator.setBackground('inventory-0.png');
        this.lbl_spectator.setIcon('ender_eye.png', 20);
        this.add(this.lbl_spectator);
        
        this.onShow = function() {
            Qubatch.releaseMousePointer();
            this.mode = this.player.game_mode.current.id;
            this.updateMode();
        };
        
        // Обработчик закрытия формы
        this.onHide = function() {
            player.world.server.Send({
                name: ServerClient.CMD_GAMEMODE_SET, 
                data: {
                    id: this.mode
                }
            });
        };
        
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
        this.lbl_survival.setBackground('inventory-0.png'); 
        this.lbl_creative.setBackground('inventory-0.png'); 
        this.lbl_adventure.setBackground('inventory-0.png'); 
        this.lbl_spectator.setBackground('inventory-0.png'); 
        switch(this.mode) {
            case 'survival': {
                this.title.setText("Режим выживания");
                this.lbl_survival.setBackground('inventory-1.png'); 
                break;
            }
            case 'creative': {
                this.title.setText("Творческий режим");
                this.lbl_creative.setBackground('inventory-1.png'); 
                break;
            }
            case 'adventure': {
                this.title.setText("Режим приключение");
                this.lbl_adventure.setBackground('inventory-1.png'); 
                break;
            }
            case 'spectator': {
                this.title.setText("Режим наблюдателя");
                this.lbl_spectator.setBackground('inventory-1.png'); 
                break;
            }
        }
    }
    
}