import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Lang } from "../lang.js";
import type { PlayerInventory } from "../player_inventory.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class ChestWindow extends BaseChestWindow {
    [key: string]: any;

    constructor(inventory : PlayerInventory) {

        const bm = inventory.player.world.block_manager
        const w = 420
        const h = 400

        super(0, 0, w, h, 'frmChest', null, null, inventory, {
            title: Lang.chest,
            sound: {
                open: {tag: bm.CHEST.sound, action: 'open'},
                close: {tag: bm.CHEST.sound, action: 'close'}
            }
        })

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-chest.png').then(async (atlas : SpriteAtlas) => {
            this.setBackground(await atlas.getSprite(0, 0, w * 2, h * 2), 'none', this.zoom / 2.0)
        })

    }

}