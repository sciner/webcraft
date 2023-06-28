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

        let margin = 17 * this.zoom

        const line_width = 14 * this.zoom

        // Заголовок
        const lbl_title = new Label(margin, 2 * line_width, 30 * this.zoom, 30 * this.zoom, 'lbl_title','No image1', 'No image')
        lbl_title.style.background.color = '#FF000055'
        this.add(lbl_title)

        // предпросмотр
        const lbl_preview = new Label(margin, lbl_title.y + lbl_title.h + 2 * line_width, 167 * this.zoom, 96 * this.zoom, 'lbl_preview','No image1', 'No image')
        lbl_preview.style.background.color = '#FF000055'
        this.add(lbl_preview)

        //список
        let y = lbl_preview.y + lbl_preview.h + line_width
        for(const item of [
            {id: 'label_data_created', title: Lang.data_created},
            {id: 'label_age', title: Lang.age},
            {id: 'label_creator', title: Lang.creator}
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

        this.lbl_public = new Label(margin, 28 * line_width, 0, 0, 'lbl_public', null, Lang.make_public)
        this.lbl_public.style.font.size = UI_THEME.base_font.size
        this.lbl_public.style.font.weight = 'bold'
        this.lbl_public.style.font.color = UI_THEME.base_font.color
        this.add(this.lbl_public)

        this.lbl_public_description = new Label(margin, 30 * line_width, 0, 0, 'lbl_public_description', null, Lang.make_public_description)
        this.lbl_public_description.style.font.size = UI_THEME.base_font.size
        this.lbl_public_description.style.font.color = UI_THEME.second_text_color
        this.add(this.lbl_public_description)

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
           // setValue('label_title', data.title)
            //setValue('label_username', data.username)
        })

    }

    // Обработчик открытия формы
    onShow(args) {
        this.player.world.server.Send({name: ServerClient.CMD_WORLD_STATS})
        super.onShow(args)
    }

}