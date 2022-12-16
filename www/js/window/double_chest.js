import { BLOCK } from "../blocks.js";
import { DEFAULT_CHEST_SLOT_COUNT} from "../constant.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class DoubleChestWindow extends BaseChestWindow {

    constructor(inventory) {
        super(10, 10, 352, 440, 'frmDoubleChest', null, null, inventory, {
            title: 'Chest',
            background: {
                image: './media/gui/form-double-chest.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 0,
                    width: 352 * 2,
                    height: 440 * 2
                }
            },
            sound: {
                open: {tag: BLOCK.CHEST.sound, action: 'open'},
                close: {tag: BLOCK.CHEST.sound, action: 'close'}
            }
        });
    }

    prepareSlots() {
        return super.prepareSlots(2 * DEFAULT_CHEST_SLOT_COUNT);
    }
}