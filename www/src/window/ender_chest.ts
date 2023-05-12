import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH } from "../constant.js";
import { Lang } from "../lang.js";
import type { PlayerInventory } from "../player_inventory.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class EnderChestWindow extends BaseChestWindow {

    constructor(inventory : PlayerInventory) {

        const bm = inventory.player.world.block_manager
        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmEnderChest', null, null, inventory, {
            title: Lang.ender_chest,
            sound: {
                open: {tag: bm.ENDER_CHEST.sound, action: 'open'},
                close: {tag: bm.ENDER_CHEST.sound, action: 'close'}
            }
        })

        this.createButtonSortChest()
    }

}