import * as PIXI from "../../blaze/pixi.js";
import { BLOCK } from "../../blocks.js";
import { INVENTORY_ICON_COUNT_PER_TEX } from "../../chunk_const.js";
import { Resources } from "../../resources.js";

/**
 * Return block image icon
 *
 * @param {object} block Block object with id property
 * @param {int} size Width and height
 *
 * @returns {?Image}
 */
export function getBlockImage(block) {

    const mat = BLOCK.fromId(block.id)
    const image = Resources.inventory.image;
    if(!image) {
        console.error('error_no_inventory_image')
        return
    }
    if(!mat) {
        console.error('error_invalid_block_id')
        return
    }
    const baseTex = PIXI.BaseTexture.from(Resources.inventory.image);
    const frame = image.width / INVENTORY_ICON_COUNT_PER_TEX
    const icon = BLOCK.getInventoryIconPos(mat.inventory_icon_id, image.width, frame)
    return new PIXI.Texture(baseTex, new PIXI.Rectangle(icon.x, icon.y, icon.width, icon.height))

}