import { Vector } from "../helpers.js";
import { Lang } from "../lang.js";
import { BaseChestWindow } from "./base_chest_window.js";
import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH } from "../constant.js";

export class BrewingWindow extends BaseChestWindow {

    constructor(inventory) {

        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmBrewing', null, null, inventory, {
            title: Lang.brewing,
            sound: {
                open: null, // {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: null // {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        })

    }

    //
    prepareSlots() {
        const resp = [];
        resp.push({pos: new Vector(32 * this.zoom, 32 * this.zoom, 0)});
        resp.push({pos: new Vector(156 * this.zoom, 32 * this.zoom, 0)});
        resp.push({pos: new Vector(204 * this.zoom, 101 * this.zoom, 0)});
        resp.push({pos: new Vector(157 * this.zoom, 115 * this.zoom, 0)});
        resp.push({pos: new Vector(110 * this.zoom, 101 * this.zoom, 0)});
        for(const slot of resp) {
            slot.pos.x += 100
            slot.pos.y += 100
        }
        return resp;
    }

    // Draw
    draw(ctx, ax, ay) {
        super.draw(ctx, ax, ay);
        if(this.state) {
            if(typeof this.style.background.image == 'object') {
                const bubble_percent = (Math.round(performance.now() / 50) % 50) / 50;
                const fuel_percent = this.state.fuel_time / this.state.max_time;
                // 1. fire
                const x = ax + this.x;
                const y = ay + this.y;
                const fire = {
                    x:      706,
                    y:      115,
                    width:  73,
                    height: 18,
                    tox:    121 * this.zoom,
                    toy:    87 * this.zoom
                };
                const fire_width = Math.floor(fire.width * (1 - fuel_percent));
                // (image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
                ctx.drawImage(
                    // image
                    this.style.background.image,
                    // sx, sy
                    fire.x, fire.y,
                    // sWidth, sHeight
                    fire.width - fire_width, fire.height,
                    // dx, dy
                    x + fire.tox,
                    y + fire.toy,
                    // dWidth, dHeight
                    (fire.width - fire_width) / 2 * this.zoom,
                    fire.height / 2 * this.zoom
                );
                // 3. bubble
                const bubble = {
                    x:      740,
                    y:      0,
                    width:  60,
                    height: 114,
                    tox:    125 * this.zoom,
                    toy:    29 * this.zoom
                };
                const bubble_height = (fuel_percent == 0) ? 0 : Math.floor(bubble.height * bubble_percent);
                ctx.drawImage(
                    // image
                    this.style.background.image,
                    // sx, sy
                    bubble.x, bubble.height - bubble_height,
                    // sWidth, sHeight
                    bubble.width, bubble_height,
                    // dx, dy
                    x + bubble.tox,
                    y + bubble.toy + (bubble.height- bubble_height) / 2 * this.zoom,
                    // dWidth, dHeight
                    bubble.width / 2 * this.zoom,
                    bubble_height / 2 * this.zoom
                );
                // 2. arrow
                const arrow = {
                    x:      706,
                    y:      0,
                    width:  36,
                    height: 110,
                    tox:    196 * this.zoom,
                    toy:    32 * this.zoom
                };
                let arrow_height = Math.floor(arrow.height * this.state.result_percent);
                ctx.drawImage(
                    this.style.background.image,
                    arrow.x,
                    arrow.y,
                    arrow.width,
                    arrow_height,
                    x + arrow.tox,
                    y + arrow.toy,
                    arrow.width / 2 * this.zoom,
                    arrow_height / 2 * this.zoom
                );
            }
        }
    }

}