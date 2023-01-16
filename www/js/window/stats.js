import {Button, Label, Window} from "../../tools/gui/wm.js";
import {ServerClient} from "../../js/server_client.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";

export class StatsWindow extends Window {

    constructor(player) {

        super(10, 10, 352, 332, "frmStats", null, null);

        this.w *= this.zoom;
        this.h *= this.zoom;
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.background.image_size_mode = 'stretch';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-empty.png');
        ct.hide();

        const LABEL_FONT_SIZE = 14;

        // Add labels to window
        let lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 300 * this.zoom, 30 * this.zoom, 'lbl1', null, Lang.btn_statistics);
        ct.add(lbl1);

        let label_death = new Label(17 * this.zoom, 50 * this.zoom, 300 * this.zoom, 68 * this.zoom, 'label_death', null, '0');
        ct.add(label_death);

        let label_time = new Label(17 * this.zoom, 80 * this.zoom, 300 * this.zoom, 98 * this.zoom, 'label_time', null, '0');
        ct.add(label_time);

        let label_pickat = new Label(17 * this.zoom, 110 * this.zoom, 300 * this.zoom, 128 * this.zoom, 'label_pickat', null, '0');
        ct.add(label_pickat);

        let label_distance = new Label(17 * this.zoom, 140 * this.zoom, 300 * this.zoom, 158 * this.zoom, 'label_distance', null, '0');
        ct.add(label_distance);

        label_death.style.font.size = LABEL_FONT_SIZE * this.zoom;
        label_time.style.font.size = LABEL_FONT_SIZE * this.zoom;
        label_pickat.style.font.size = LABEL_FONT_SIZE * this.zoom;
        label_distance.style.font.size = LABEL_FONT_SIZE * this.zoom;

        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Qubatch.releaseMousePointer();
            player.world.server.Send({name: ServerClient.CMD_STATS});
        }

        // Обработчик закрытия формы
        this.onHide = function() {}

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            let btnClose = new Button(ct.width - this.cell_size, 12 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image = image;
            btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onMouseDown = function(e) {
                console.log(e);
                ct.hide();
            }
            ct.add(btnClose);
        });

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.E:
                case KEY.ESC: {
                    if(!down) {
                        ct.hide();
                        try {
                            Qubatch.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    return true;
                }
            }
            return false;
        }

        player.world.server.AddCmdListener([ServerClient.CMD_STATS], (cmd) => {
            let times = cmd.data.time_formatted;
            times = times.replace('days', Lang.days);
            times = times.replace('hours', Lang.hours);
            times = times.replace('minutes', Lang.minutes);
            label_death.text = `${Lang.stat_death}: ${cmd.data.death}`;
            label_time.text = `${Lang.stat_time}: ` + times;
            label_pickat.text = `${Lang.stat_pickat}: ${cmd.data.pickat}`;
            label_distance.text = `${Lang.stat_distance}: ${cmd.data.distance_formatted}`;
        });
    }

}