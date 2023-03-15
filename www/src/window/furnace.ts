import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Vector } from "../helpers.js";
import { Lang } from "../lang.js";
import { BaseChestWindow } from "./base_chest_window.js";
import { Button, Label, Window, Icon } from "../../tools/gui/wm.js";
import { MySprite } from "../../tools/gui/MySpriteRenderer.js"
import { PIXI } from "../../tools/gui/pixi.js"



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

        this.icon_array = new Icon(158, 68.5, 96, 68, this.zoom, 'iconArray')
        this.add(this.icon_array)

        this.icon_fire = new Icon(112.5, 72, 58, 56, this.zoom, 'iconFire')
        this.icon_fire.axis_x = false
        this.add(this.icon_fire)

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-furnace.png').then(async atlas => {
            this.setBackground(await atlas.getSprite(0, 0, 352 * 2, 332 * 2), 'none', this.zoom / 2.0)
            this.icon_array.setBackground(await this.atlas.getSprite(704, 56, 96, 68), 'none', this.zoom / 2.0 )
            this.icon_fire.setBackground(await this.atlas.getSprite(704, 0, 58, 56), 'none', this.zoom / 2.0 )
        })
        
    }

    //
    prepareSlots() {
        const resp = [];
        resp.push({pos: new Vector(111 * this.zoom, 32 * this.zoom, 0)});
        resp.push({pos: new Vector(111 * this.zoom, 105 * this.zoom, 0)});
        resp.push({pos: new Vector(230 * this.zoom, 68 * this.zoom, 0), readonly: true});
        return resp;
    }

    // Пришло содержимое сундука от сервера
    setData(chest) {
        super.setData(chest)
        if (this.state) {
            const fuel_percent = this.state.fuel_time / this.state.max_time
            this.icon_array.scroll(this.state.result_percent)
            this.icon_fire.scroll(1 - fuel_percent) 
        }
    }
}