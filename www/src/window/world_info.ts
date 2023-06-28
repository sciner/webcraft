import { Button, Label, Slider } from "../ui/wm.js";
import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE, UI_THEME } from "../constant.js";
import { BlankWindow } from "./blank.js";

export class WorldInfoWindow extends BlankWindow {

    constructor(player) {

        super(0, 0, 352, 332, "frmWorldInfo", null, null)
        this.w *= this.zoom
        this.h *= this.zoom
        this.player = player
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom
        this.setBackground('./media/gui/form-empty.png')

        let x = 17 * this.zoom
        let y = 17 * this.zoom
        let w = 300 * this.zoom
        const one_line = 22 * this.zoom
        const margin = 8 * this.zoom

        const getY = () => {
            const resp = y
            y += one_line + margin
            return resp
        }

        //
        for(const item of [
            {id: 'label_title', title: Lang.stat_death},
            {id: 'label_username', title: Lang.stat_time}
        ]) {
            const y = getY()
            const lbl_title = new Label(x, y, w, one_line, item.id + '_title', item.title, item.title)
            const lbl = new Label(x + 100 * this.zoom, y, w, one_line, item.id, item.title, item.title)
            lbl_title.style.font.size = UI_THEME.base_font.size
            lbl_title.style.font.weight = 'bold'
            lbl_title.style.font.color = UI_THEME.base_font.color
            lbl.style.textAlign.horizontal = 'right'
            lbl.style.font.size = UI_THEME.base_font.size
            lbl.style.font.color = UI_THEME.second_text_color
            this.add(lbl_title)
            this.add(lbl)
        }

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
            const data = cmd.data
            setValue('label_title', data.title)
            setValue('label_username', data.username)
        })

    }

    // Обработчик открытия формы
    onShow(args) {
        this.player.world.server.Send({name: ServerClient.CMD_WORLD_STATS})
        super.onShow(args)
    }

}