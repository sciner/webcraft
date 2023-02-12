import { SpriteAtlas } from "../core/sprite_atlas.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class ChestWindow extends BaseChestWindow {

    constructor(inventory) {

        const bm = inventory.player.world.block_manager

        super(10, 10, 352, 332, 'frmChest', null, null, inventory, {
            title: 'Chest',
            sound: {
                open: {tag: bm.CHEST.sound, action: 'open'},
                close: {tag: bm.CHEST.sound, action: 'close'}
            }
        })

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-chest.png').then(async atlas => {
            this.setBackground(await atlas.getSprite(0, 0, 352 * 2, 332 * 2), 'none', this.zoom / 2.0)
        })

    }

}