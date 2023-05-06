import { Vector } from "../helpers.js";
import { Lang } from "../lang.js";
import { BaseChestWindow } from "./base_chest_window.js";
import { Icon } from "../ui/wm.js";
import type { PlayerInventory } from "../player_inventory.js";
import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH } from "../constant.js";

export class FurnaceWindow extends BaseChestWindow {

    icon_arrow : Icon
    icon_fire : Icon

    constructor(inventory : PlayerInventory) {

        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmFurnace', null, null, inventory, {
            title: Lang.furnace,
            sound: {
                open: null, // {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: null // {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        })

        this.icon_arrow = new Icon(158, 68.5, 96, 68, 'iconArrow', this.zoom)
        this.add(this.icon_arrow)

        this.icon_fire = new Icon(112.5, 72, 58, 56, 'iconFire', this.zoom)
        this.icon_fire.axis_x = false
        this.add(this.icon_fire)

        // Create sprite atlas
       /* this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-furnace.png').then(async (atlas : SpriteAtlas) => {
            this.setBackground(await atlas.getSprite(0, 0, w * 2, h * 2), 'none', this.zoom / 2.0)
            this.icon_arrow.setBackground(await this.atlas.getSprite(840, 56, 96, 68), 'none', this.zoom / 2.0 )
            this.icon_fire.setBackground(await this.atlas.getSprite(840, 0, 58, 56), 'none', this.zoom / 2.0 )
        })*/
        
    }

    //
    prepareSlots() {
        const resp = [];
        resp.push({pos: new Vector(108, 31, 0).multiplyScalarSelf(this.zoom)});
        resp.push({pos: new Vector(108, 104, 0).multiplyScalarSelf(this.zoom)});
        resp.push({pos: new Vector(230, 68, 0).multiplyScalarSelf(this.zoom), readonly: true});
        return resp;
    }

    // Пришло содержимое сундука от сервера
    setData(chest : any) {
        super.setData(chest)
        if (this.state) {
            const fuel_percent = this.state.fuel_time / this.state.max_time
            this.icon_arrow.scroll(this.state.result_percent)
            this.icon_fire.scroll(fuel_percent)
        } else {
            this.icon_arrow.scroll(0)
            this.icon_fire.scroll(0)
        }
    }

}