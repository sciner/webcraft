import { DEFAULT_CHEST_SLOT_COUNT} from "../constant.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Lang } from "../lang.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class DoubleChestWindow extends BaseChestWindow {
    [key: string]: any;

    constructor(inventory) {

        const bm = inventory.player.world.block_manager

        const w = 420
        const h = 530

        super(0, 0, w, h, 'frmDoubleChest', null, null, inventory, {
            title: Lang.chest,
            sound: {
                open: {tag: bm.CHEST.sound, action: 'open'},
                close: {tag: bm.CHEST.sound, action: 'close'}
            }
        })

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-double-chest.png').then(async atlas => {
            // this.style.background.color = '#333377cc'
            this.setBackground(await atlas.getSprite(0, 0, w * 2, h * 2), 'none', this.zoom / 2.0)
        })

    }

    prepareSlots() {
        return super.prepareSlots(2 * DEFAULT_CHEST_SLOT_COUNT);
    }

}