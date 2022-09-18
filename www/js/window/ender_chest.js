import {BLOCK} from "../blocks.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class EnderChestWindow extends BaseChestWindow {

    constructor(inventory) {
        super(10, 10, 352, 332, 'frmEnderChest', null, null, inventory, {
            title: 'Ender chest',
            background: {
                image: './media/gui/form-chest.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 0,
                    width: 352 * 2,
                    height: 332 * 2
                }
            },
            sound: {
                open: {tag: BLOCK.ENDER_CHEST.sound, action: 'open'},
                close: {tag: BLOCK.ENDER_CHEST.sound, action: 'close'}
            }
        });
    }

}