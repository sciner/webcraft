import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Lang } from "../lang.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class EnderChestWindow extends BaseChestWindow {
    [key: string]: any;

    constructor(inventory) {

        const BLOCK = inventory.player.world.block_manager
        super(10, 10, 352, 332, 'frmEnderChest', null, null, inventory, {
            title: Lang.ender_chest,
            sound: {
                open: {tag: BLOCK.ENDER_CHEST.sound, action: 'open'},
                close: {tag: BLOCK.ENDER_CHEST.sound, action: 'close'}
            }
        })

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-chest.png').then(async atlas => {
            this.setBackground(await atlas.getSprite(0, 0, 352 * 2, 332 * 2), 'none', this.zoom / 2.0)
        })

    }

}