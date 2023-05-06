import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH } from "../constant.js";
import { Lang } from "../lang.js";
import type { PlayerInventory } from "../player_inventory.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class ChestWindow extends BaseChestWindow {
    [key: string]: any;

    constructor(inventory : PlayerInventory) {

        const bm = inventory.player.world.block_manager

        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmChest', null, null, inventory, {
            title: Lang.chest,
            sound: {
                open: {tag: bm.CHEST.sound, action: 'open'},
                close: {tag: bm.CHEST.sound, action: 'close'}
            }
        })
    }

}