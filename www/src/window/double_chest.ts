import { DEFAULT_CHEST_SLOT_COUNT, INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH} from "../constant.js";
import { Lang } from "../lang.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class DoubleChestWindow extends BaseChestWindow {

    constructor(inventory) {

        const bm = inventory.player.world.block_manager

        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmDoubleChest', null, null, inventory, {
            title: Lang.chest,
            sound: {
                open: {tag: bm.CHEST.sound, action: 'open'},
                close: {tag: bm.CHEST.sound, action: 'close'}
            }
        })

        this.createButtonSortChest()
    }

    prepareSlots() {
        return super.prepareSlots(2 * DEFAULT_CHEST_SLOT_COUNT);
    }

}