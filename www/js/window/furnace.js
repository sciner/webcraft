import { Vector } from "../helpers.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class FurnaceWindow extends BaseChestWindow {

    constructor(inventory) {

        super(10, 10, 352, 332, 'frmFurnace', null, null, inventory, {
            title: 'Furnace',
            background: {
                image: './media/gui/form-furnace.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 0,
                    width: 352 * 2,
                    height: 332 * 2
                }
            },
            sound: {
                open: null, // {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: null // {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        });

    }

    //
    prepareSlots() {
        const resp = [];
        resp.push({pos: new Vector(222, 64, 0)});
        resp.push({pos: new Vector(222, 210, 0)});
        resp.push({pos: new Vector(460, 136, 0), readonly: true});
        return resp;
    }

    // Draw
    draw(ctx, ax, ay) {
        super.draw(ctx, ax, ay);
        if(this.state) {
            if(typeof this.style.background.image == 'object') {
                const fuel_percent = this.state.fuel_time / this.state.max_time;
                // 1. fire
                let x = ax + this.x;
                let y = ay + this.y;
                const fire = {x: 704, y: 0, width: 56, height: 56, tox: 113 * this.zoom, toy: 73 * this.zoom};
                let sub_height = Math.floor(fire.height * (1 - fuel_percent));
                ctx.drawImage(
                    this.style.background.image,
                    fire.x,
                    sub_height,
                    fire.width,
                    fire.height - sub_height,
                    x + fire.tox,
                    y + fire.toy + sub_height,
                    fire.width,
                    fire.height - sub_height
                );
                // 2. arrow
                const arrow = {x: 704, y: 56, width: 96, height: 68, tox: 158 * this.zoom, toy: 69 * this.zoom};
                let arrow_width = Math.floor(arrow.width * this.state.result_percent);
                ctx.drawImage(
                    this.style.background.image,
                    arrow.x,
                    arrow.y,
                    arrow_width,
                    arrow.height,
                    x + arrow.tox,
                    y + arrow.toy,
                    arrow_width,
                    arrow.height
                );
            }
        }
    }

}