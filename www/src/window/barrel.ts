import { Lang } from "../lang.js";
import type { PlayerInventory } from "../player_inventory.js";
import { BaseChestWindow } from "./base_chest_window.js";
import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH } from "../constant.js";

export class BarrelWindow extends BaseChestWindow {

    constructor(inventory : PlayerInventory) {

        const bm = inventory.player.world.block_manager
        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmBarrel', null, null, inventory, {
            title: Lang.barrel,
            sound: {
                open: {tag: bm.BARREL.sound, action: 'open'},
                close: {tag: bm.BARREL.sound, action: 'close'}
            }
        })
    }

}