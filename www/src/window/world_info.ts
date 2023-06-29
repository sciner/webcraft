import { Button, Label, Slider } from "../ui/wm.js";
import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE, UI_THEME } from "../constant.js";
import { BlankWindow } from "./blank.js";
import { Resources } from "../resources.js";

export class WorldInfoWindow extends BlankWindow {

    constructor(player) {

        super(0, 0, 352, 332, "frmWorldInfo", null, null)
        this.w *= this.zoom
        this.h *= this.zoom
        this.player = player
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom
        this.setBackground('./media/gui/form-empty.png')

        const margin = 17 * this.zoom
        const line_width = 14 * this.zoom
        const hud_atlas = Resources.atlas.get('hud')

        // Заголовок
        const lblName = new Label(margin, 2 * line_width, 100 * this.zoom, 20 * this.zoom, 'lblName', null, 'World Name')
        lblName.style.font.size = 16
        lblName.style.font.weight = 'bold'
        lblName.style.background.color = '#FF000055'
        this.add(lblName)

        const btnSwitchOfficial = new Label(this.w - margin - 17 * this.zoom, 2 * line_width, 17 * this.zoom, 17 * this.zoom, 'btnSwitchOfficial')
        btnSwitchOfficial.setBackground(hud_atlas.getSpriteFromMap('check_bg'))
        btnSwitchOfficial.onMouseDown = function() {
            
        }
        this.add(btnSwitchOfficial)

        // предпросмотр
        const lbl_preview = new Label(margin, lblName.y + lblName.h + 2 * line_width, 167 * this.zoom, 96 * this.zoom, 'lbl_preview', null, 'No image')
        lbl_preview.style.background.color = '#FF000055'
        this.add(lbl_preview)

        //список
        let y = lbl_preview.y + lbl_preview.h + 2 * line_width
        for(const item of [
            {id: 'lblDataCreated', title: Lang.data_created},
            {id: 'lblAge', title: Lang.age},
            {id: 'lblCreator', title: Lang.creator}
        ]) {
            const lbl_title = new Label(margin, y, 0, 0, item.id + '_title', item.title, item.title)
            const lbl = new Label(this.w - margin, y, 0, 0, item.id, item.title, item.title)
            lbl_title.style.font.size = UI_THEME.base_font.size
            lbl_title.style.font.weight = 'bold'
            lbl_title.style.font.color = UI_THEME.base_font.color
            lbl.style.textAlign.horizontal = 'right'
            lbl.style.font.size = UI_THEME.base_font.size
            lbl.style.font.color = UI_THEME.second_text_color
            this.add(lbl_title)
            this.add(lbl)
            y += 2 * line_width
        }

        const lbl_public = new Label(margin, 28 * line_width, 0, 0, 'lbl_public', null, Lang.make_public)
        lbl_public.style.font.size = UI_THEME.base_font.size
        lbl_public.style.font.weight = 'bold'
        lbl_public.style.font.color = UI_THEME.base_font.color
        this.add(lbl_public)

        const lbl_public_description = new Label(margin, 30 * line_width, 0, 0, 'lbl_public_description', null, Lang.make_public_description)
        lbl_public_description.style.font.size = UI_THEME.base_font.size
        lbl_public_description.style.font.color = UI_THEME.second_text_color
        this.add(lbl_public_description)

        //
        const setValue = (id : string, value : string) => {
            for(const w of this.list.values()) {
                if(w.id == id) {
                    w.text = value
                }
            }
        }

        //
        player.world.server.AddCmdListener([ServerClient.CMD_WORLD_STATS], (cmd) => {
            console.log(cmd)
            const data = cmd.data
            setValue('lblName', data.title)
            setValue('lblCreator', data.username)
            setValue('lblDataCreated', data.time_formatted)
            setValue('lblAge', data.age)
        })

    }

    // Обработчик открытия формы
    onShow(args) {
        this.player.world.server.Send({name: ServerClient.CMD_WORLD_STATS})
        super.onShow(args)
    }

}