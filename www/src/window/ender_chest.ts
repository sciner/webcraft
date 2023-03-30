import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Lang } from "../lang.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class EnderChestWindow extends BaseChestWindow {
    [key: string]: any;

    constructor(inventory) {

        const w = 352
        const h = 332

        const BLOCK = inventory.player.world.block_manager

        super(0, 0, w, h, 'frmEnderChest', null, null, inventory, {
            title: Lang.ender_chest,
            sound: {
                open: {tag: BLOCK.ENDER_CHEST.sound, action: 'open'},
                close: {tag: BLOCK.ENDER_CHEST.sound, action: 'close'}
            }
        })

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-chest.png').then(async atlas => {
            this.setBackground(await atlas.getSprite(0, 0, w * 2, h * 2), 'none', this.zoom / 2.0)
        })

    }

}