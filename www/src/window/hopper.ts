import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Vector } from "../helpers.js";
import { Lang } from "../lang.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class HopperWindow extends BaseChestWindow {
    [key: string]: any;

    constructor(inventory) {

        super(0, 0, 352, 266, 'frmHopper', null, null, inventory, {
            title: Lang.hopper,
            sound: {
                open: null, // {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: null // {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        })

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-hopper.png').then(async atlas => {
            this.setBackground(await atlas.getSprite(0, 0, 352 * 2, 266 * 2), 'none', this.zoom / 2.0)
        })

    }

    //
    prepareSlots() {
        const resp = [];
        resp.push({pos: new Vector(86 * this.zoom, 38 * this.zoom, 0)})
        resp.push({pos: new Vector(122 * this.zoom, 38 * this.zoom, 0)})
        resp.push({pos: new Vector(158 * this.zoom, 38 * this.zoom, 0)})
        resp.push({pos: new Vector(194 * this.zoom, 38 * this.zoom, 0)})
        resp.push({pos: new Vector(230 * this.zoom, 38 * this.zoom, 0)})
        return resp;
    }

}