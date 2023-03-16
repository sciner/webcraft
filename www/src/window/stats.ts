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

        const label_death = new Label(x, getY(), w, one_line, 'label_death', null, '0');
        this.add(label_death)

        const label_time = new Label(x, getY(), w, one_line, 'label_time', null, '0');
        this.add(label_time)

        const label_pickat = new Label(x, getY(), w, one_line, 'label_pickat', null, '0');
        this.add(label_pickat)

        const label_distance = new Label(x, getY(), w, one_line, 'label_distance', null, '0');
        this.add(label_distance)

        // const btnClose = new Button(this.w - this.cell_size, 12 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '')
        // this.add(btnClose)

        // // Add close button
        // this.loadCloseButtonImage((image) => {
        //     // Add buttons
        //     const that = this
        //     // Close button
        //     btnClose.style.font.family = 'Arial'
        //     btnClose.style.background.image = image
        //     btnClose.style.background.image_size_mode = 'stretch';
        //     btnClose.onMouseDown = function(e) {
        //         that.hide()
        //     }
        // })

        player.world.server.AddCmdListener([ServerClient.CMD_STATS], (cmd) => {
            let times = cmd.data.time_formatted;
            times = times.replace('days', Lang.days);
            times = times.replace('hours', Lang.hours);
            times = times.replace('minutes', Lang.minutes);
            label_death.text = `${Lang.stat_death}: ${cmd.data.death}`;
            label_time.text = `${Lang.stat_time}: ` + times;
            label_pickat.text = `${Lang.stat_pickat}: ${cmd.data.pickat}`;
            label_distance.text = `${Lang.stat_distance}: ${cmd.data.distance_formatted}`;
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