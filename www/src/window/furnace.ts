import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Vector } from "../helpers.js";
import { Lang } from "../lang.js";
import { BaseChestWindow } from "./base_chest_window.js";
import { Button, Label } from "../../tools/gui/wm.js";

export class FurnaceWindow extends BaseChestWindow {
    [key: string]: any;

    constructor(inventory) {

        super(0, 0, 352, 332, 'frmFurnace', null, null, inventory, {
            title: Lang.furnace,
            sound: {
                open: null, // {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: null // {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        })

        this.test = new Label(50, 50, 50, 50, `11111_bgicon`, '444', '555')
        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-furnace.png').then(async atlas => {
            //this.setBackground(await atlas.getSprite(0, 0, 352 * 2, 332 * 2), 'none', this.zoom / 2.0)
            this.test.setBackground(await this.atlas.getSprite(704, 0, 58, 56), 'none', this.zoom)
        })

        
        
        
        this.add(this.test)
    }

    //
    prepareSlots() {
        const resp = [];
        resp.push({pos: new Vector(111 * this.zoom, 32 * this.zoom, 0)});
        resp.push({pos: new Vector(111 * this.zoom, 105 * this.zoom, 0)});
        resp.push({pos: new Vector(230 * this.zoom, 68 * this.zoom, 0), readonly: true});
        return resp;
    }

    // Draw
    // TODO: pixi
    draw(ctx, ax, ay) {
        super.draw(ctx, ax, ay);
        if(this.state) {
            if(typeof this.style.background.image == 'object') {
                const fuel_percent = this.state.fuel_time / this.state.max_time;
                // 1. fire
                let x = ax + this.x;
                let y = ay + this.y;
                const fire = {
                    x:      704,
                    y:      0,
                    width:  58,
                    height: 58,
                    tox:    113 * this.zoom,
                    toy:    73 * this.zoom
                };
                const sub_height = Math.floor(fire.height * (1 - fuel_percent));
                // (image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
                ctx.drawImage(
                    // image
                    this.style.background.image,
                    // sx, sy
                    fire.x, fire.y + sub_height,
                    // sWidth, sHeight
                    fire.width, fire.height - sub_height,
                    // dx, dy
                    x + fire.tox,
                    y + fire.toy + sub_height / 2 * this.zoom,
                    // dWidth, dHeight
                    fire.width / 2 * this.zoom,
                    (fire.height - sub_height) / 2 * this.zoom
                );
                // 2. arrow
                const arrow = {
                    x:      704,
                    y:      56,
                    width:  96,
                    height: 68,
                    tox:    158 * this.zoom,
                    toy:    69 * this.zoom
                };
                let arrow_width = Math.floor(arrow.width * this.state.result_percent);
                ctx.drawImage(
                    this.style.background.image,
                    arrow.x,
                    arrow.y,
                    arrow_width,
                    arrow.height,
                    x + arrow.tox,
                    y + arrow.toy,
                    arrow_width / 2 * this.zoom,
                    arrow.height / 2 * this.zoom
                );
            }
        }
    }

}