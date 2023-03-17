import { Button, Label, Slider } from "../../tools/gui/wm.js";
import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { BlankWindow } from "./blank.js";

export class StatsWindow extends BlankWindow {

    constructor(player) {

        super(10, 10, 352, 332, "frmStats", null, null)
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom
        this.player = player
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom
        this.setBackground('./media/gui/form-empty.png')

        // Add labels to window
        // const lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 300 * this.zoom, 30 * this.zoom, 'lbl1', null, Lang.btn_statistics);
        // this.add(lbl1)

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
        for(let item of [
            {id: 'label_death', title: Lang.stat_death},
            {id: 'label_time', title: Lang.stat_time},
            {id: 'label_pickat', title: Lang.stat_pickat},
            {id: 'label_distance', title: Lang.stat_distance},
        ]) {
            const y = getY()
            const lbl_title = new Label(x, y, w, one_line, item.id + '_title', item.title, item.title)
            const lbl = new Label(x + 100 * this.zoom, y, w, one_line, item.id, item.title, item.title)
            lbl_title.style.font.size = 14
            lbl_title.style.font.weight = 'bold'
            lbl.style.textAlign.horizontal = 'right'
            lbl.style.font.size = 14
            this.add(lbl_title)
            this.add(lbl)
        }

        //
        const setValue = (id : string, value : string) => {
            for(let w of this.list.values()) {
                if(w.id == id) {
                    w.text = value
                }
            }
        }

        //
        player.world.server.AddCmdListener([ServerClient.CMD_STATS], (cmd) => {

            let times = cmd.data.time_formatted;
            times = times.replace('days', Lang.days);
            times = times.replace('hours', Lang.hours);
            times = times.replace('minutes', Lang.minutes);

            setValue('label_death', cmd.data.death)
            setValue('label_time', times)
            setValue('label_pickat', cmd.data.pickat)
            setValue('label_distance', cmd.data.distance_formatted)

        })

    }

    // Обработчик открытия формы
    onShow(args) {
        // this.getRoot().center(this)
        // Qubatch.releaseMousePointer()
        this.player.world.server.Send({name: ServerClient.CMD_STATS})
        super.onShow(args)
    }

    // Обработчик закрытия формы
    onHide() {}

}