import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { KEY, UI_THEME } from "../constant.js";
import { Label, Window } from "../ui/wm.js";
import { Resources } from "../resources.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";

const GAME_MODE_LIST = ['survival', 'creative', 'adventure', 'spectator']
const ICON_SCALE = .9

export class ModeWindow extends Window {

    atlas : SpriteAtlas
    hud_atlas : SpriteAtlas
    form_atlas : SpriteAtlas

    constructor(player) {

        const w = 220
        const h = 130

        super(0, 0, w, h, 'frmMode')
        this.w *= this.zoom
        this.h *= this.zoom
        // this.style.background.color = '#00000055'

        this.player = player
        this.mode == 'survival'

        this.atlas = Resources.atlas.get('icons')
        this.hud_atlas = Resources.atlas.get('hud')

        // Create sprite atlas
        this.form_atlas = new SpriteAtlas()
        this.form_atlas.fromFile('./media/gui/form-mode.png').then(async (atlas : SpriteAtlas) => {
            this.setBackground(await atlas.getSprite(0, 0, w * 2, h * 2), 'none', this.zoom / 2.0)
        })

        const lblTitle = this.addComponent(0, 15, 217, 22, 'lblTitle', 'Test')
        const lblHelp = this.addComponent(0, 105, 217, 22, 'lblHelp', '[ F4 ] - ' + Lang.next)
        this.addComponent(8, 48, 48, 48, 'lblSurvival', null, 'iron_sword.png')
        this.addComponent(60, 48, 48, 48, 'lblCreative', null, 'brick.png')
        this.addComponent(112, 48, 48, 48, 'lblAdventure', null, 'map.png')
        this.addComponent(164, 48, 48, 48, 'lblSpectator', null, 'ender_eye.png')

        lblHelp.style.font.color = UI_THEME.base_font.color
        lblHelp.style.font.size = UI_THEME.base_font.size * 0.65
        lblTitle.style.font.color = UI_THEME.base_font.color

    }

    addComponent(x : float, y : float, w : float, h : float, id : string, title? : string, icon? : string) {
        const label = this[id] = new Label(x * this.zoom, y * this.zoom, w * this.zoom, h * this.zoom, id, title, title)
        if(icon) {
            label.setIcon(this.atlas.getSpriteFromMap(icon), 'centerstretch', ICON_SCALE)
        }
        label.style.textAlign.horizontal = 'center'
        label.style.font.color = '#ffffff'
        this.add(label)
        return label
    }

    // When window on show
    onShow(args) {
        this.getRoot().center(this)
        Qubatch.releaseMousePointer()
        this.mode = this.prev_mode ?? this.player.game_mode.next(true).id
        this.updateMode()
        super.onShow(args)
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
            return this.hud_atlas.getSpriteFromMap(mode == this.mode ? 'slot_full' : 'slot_empty')
        }

        this.lblSurvival.setBackground(getModeSprite('survival'), 'centerstretch', 1)
        this.lblCreative.setBackground(getModeSprite('creative'), 'centerstretch', 1)
        this.lblAdventure.setBackground(getModeSprite('adventure'), 'centerstretch', 1)
        this.lblSpectator.setBackground(getModeSprite('spectator'), 'centerstretch', 1)

        this.lblTitle.setText(Lang.getOrUnchanged(`gamemode_${this.mode}`));

    }

}