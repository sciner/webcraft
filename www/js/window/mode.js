import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { KEY } from "../constant.js";
import { Label, Window } from "../../tools/gui/wm.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Resources } from "../resources.js";

export class ModeWindow extends Window {

    constructor(player) {

        super(0, 0, 217, 130, 'frmMode');
        this.style.background.color = '00000055'

        this.player = player;
        this.mode == 'survival'

        SpriteAtlas.fromJSON('./media/icons.png', Resources.icons).then(async atlas => {

            this.atlas = atlas

            this.add(new Label(0, 90, 217, 43, 'lblHelp', '[ F4 ] - Дальше', this))

            this.title = new Label(0, 0, 217, 43, 'lblTitle', 'Test', this)
            this.title.setBackground(await atlas.getSpriteFromMap('toasts-0.png'))
            this.add(this.title)

            this.lblSurvival = new Label(5, 48, 48, 48, 'lblSurvival', null, this)
            // this.lblSurvival.setBackground(atlas.getSpriteFromMap('inventory-0.png'))
            this.lblSurvival.setIcon(await atlas.getSpriteFromMap('iron_sword.png'), 20)
            this.add(this.lblSurvival)

            this.lblCreative = new Label(58, 48, 48, 48, 'lblCreative', null, this)
            // this.lblCreative.setBackground(atlas.getSpriteFromMap('inventory-0.png'))
            this.lblCreative.setIcon(await atlas.getSpriteFromMap('brick.png'), 20)
            this.add(this.lblCreative)

            this.lblAdventure = new Label(111, 48, 48, 48, 'lblAdventure', null, this)
            // this.lblAdventure.setBackground(atlas.getSpriteFromMap('inventory-0.png'))
            this.lblAdventure.setIcon(await atlas.getSpriteFromMap('map.png'), 20)
            this.add(this.lblAdventure)

            this.lblSpectator = new Label(164, 48, 48, 48, 'lblSpectator', null, this)
            // this.lblSpectator.setBackground(atlas.getSpriteFromMap('inventory-0.png'))
            this.lblSpectator.setIcon(await atlas.getSpriteFromMap('ender_eye.png'), 20)
            this.add(this.lblSpectator)

        })

        // When window on show
        this.onShow = function() {
            Qubatch.releaseMousePointer()
            this.mode = this.prev_mode ?? this.player.game_mode.next(true).id
            this.updateMode()
        }

        // Обработчик закрытия формы
        this.onHide = function() {
            this.prev_mode = this.player.game_mode.current.id;
            if(this.prev_mode != this.mode) {
                player.world.server.Send({
                    name: ServerClient.CMD_GAMEMODE_SET, 
                    data: {
                        id: this.mode
                    }
                });
            }
        }

        //
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.F4: {
                    if(down) {
                        if (this.mode == 'survival') {
                            this.mode = 'creative';
                        } else if (this.mode == 'creative') {
                            this.mode = 'adventure';
                        } else if (this.mode == 'adventure') {
                            this.mode = 'spectator';
                        } else { 
                            this.mode = 'survival';
                        }
                        this.updateMode()
                    }
                    return true;
                }
            }
            return false;
        }
    
    }

    async updateMode() {

        const getModeSprite = async (mode) => {
            return this.atlas.getSpriteFromMap(mode == this.mode ? 'inventory-1.png' : 'inventory-0.png')
        }

        this.lblSurvival.setBackground(await getModeSprite('survival'))
        this.lblCreative.setBackground(await getModeSprite('creative'))
        this.lblAdventure.setBackground(await getModeSprite('adventure'))
        this.lblSpectator.setBackground(await getModeSprite('spectator'))

        this.title.setText(Lang.getOrUnchanged(`gamemode_${this.mode}`));

    }
    
}