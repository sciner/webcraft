import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { KEY } from "../constant.js";
import { Label, Window } from "../../tools/gui/wm.js";
import { Resources } from "../resources.js";

const GAME_MODE_LIST = ['survival', 'creative', 'adventure', 'spectator']
const ICON_SCALE = .9

export class ModeWindow extends Window {
    [key: string]: any;

    constructor(player) {

        const w = 217
        const h = 130

        super(0, 0, w * UI_ZOOM, h * UI_ZOOM, 'frmMode')

        this.style.background.color = '#00000055'
        this.player = player
        this.mode == 'survival'

        this.atlas = Resources.atlas.icons

        const lblHelp = this.addComponent(w / 2, 100, w, 43, 'lblHelp', '[ F4 ] - Дальше')
        lblHelp.style.font.anchor.x = .5
        lblHelp.style.font.align = 'center'
        this.lblHelp.style.font.color = '#ffffff'

        const lblTitle = this.addComponent(w / 2, 10, w, 43, 'lblTitle', 'Test', 'toasts-0.png')
        lblTitle.style.font.anchor.x = .5
        lblTitle.style.font.align = 'center'
        this.lblTitle.style.font.color = '#ffffff'

        this.addComponent(5, 48, 48, 48, 'lblSurvival', null, 'iron_sword.png')
        this.addComponent(58, 48, 48, 48, 'lblCreative', null, 'brick.png')
        this.addComponent(111, 48, 48, 48, 'lblAdventure', null, 'map.png')
        this.addComponent(164, 48, 48, 48, 'lblSpectator', null, 'ender_eye.png')

    }

    addComponent(x, y, w, h, id, title, icon?) {
        const label = this[id] = new Label(x * this.zoom, y * this.zoom, w * this.zoom, h * this.zoom, id, title, title)
        if(icon) {
            label.setIcon(this.atlas.getSpriteFromMap(icon), 'centerstretch', ICON_SCALE)
        }
        label.style.font.size = 16
        this.add(label)
        return label
    }

    // When window on show
    onShow() {
        this.getRoot().center(this)
        Qubatch.releaseMousePointer()
        this.mode = this.prev_mode ?? this.player.game_mode.next(true).id
        this.updateMode()
        super.onShow()
    }

    // Обработчик закрытия формы
    onHide() {
        const player = this.player
        this.prev_mode = this.player.game_mode.current.id;
        if(this.prev_mode != this.mode) {
            player.world.server.Send({
                name: ServerClient.CMD_GAMEMODE_SET,
                data: {
                    id: this.mode
                }
            })
        }
    }

    onKeyEvent(e) {
        const {keyCode, down, first} = e
        switch(keyCode) {
            case KEY.F4: {
                if(down) {
                    const index = GAME_MODE_LIST.indexOf(this.mode)
                    this.mode = GAME_MODE_LIST[(index + 1) % GAME_MODE_LIST.length]
                    this.updateMode()
                }
                return true
            }
        }
        return false
    }

    async updateMode() {

        const getModeSprite = (mode) => {
            return this.atlas.getSpriteFromMap(mode == this.mode ? 'inventory-1.png' : 'inventory-0.png')
        }

        this.lblSurvival.setBackground(getModeSprite('survival'), 'centerstretch', 1)
        this.lblCreative.setBackground(getModeSprite('creative'), 'centerstretch', 1)
        this.lblAdventure.setBackground(getModeSprite('adventure'), 'centerstretch', 1)
        this.lblSpectator.setBackground(getModeSprite('spectator'), 'centerstretch', 1)

        this.lblTitle.setText(Lang.getOrUnchanged(`gamemode_${this.mode}`));

    }

}