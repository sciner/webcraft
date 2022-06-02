import {BLOCK} from "../blocks.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class ChestWindow extends BaseChestWindow {

    constructor(x, y, w, h, id, title, text, inventory) {
        super(x, y, w, h, id, title, text, inventory, {
            title: 'Chest',
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
                open: {tag: BLOCK.CHEST.sound, action: 'open'},
                close: {tag: BLOCK.CHEST.sound, action: 'close'}
            }
        });
    }

}