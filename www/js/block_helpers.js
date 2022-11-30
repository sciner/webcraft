import { BLOCK } from "./blocks.js";
import { ROTATE, Vector } from "./helpers.js";

export class ChestHelpers {

    // TODO left/right in extra_data
    static findSecondHalf(world, pos) {
        const block = world.getBlock(pos);
        if (!block || block.material.name != "CHEST" || !block.extra_data) {
            return null;
        }
        const dir = BLOCK.getCardinalDirection(block.rotate);
        const dxz = RIGHT_NEIGBOUR_BY_DIRECTION[dir];
        const secondPos = pos.clone().addSelf(dxz);
        const secondBlock = world.getBlock(secondPos);
        if (!secondBlock || secondBlock.material.name != "CHEST" || !secondBlock.extra_data ||
            BLOCK.getCardinalDirection(secondBlock.rotate) !== dir
        ) {
            return null;
        }
        return {
            pos: secondPos,
            extra_data: secondBlock.extra_data
        };
    }

    // returns a range that one chest ocupies withing a single/double chest UI
    static getOneChestRange(isFirst, hasSecond, length) {
        var min = 0;
        if (hasSecond) {
            length /= 2;
            if (!isFirst) {
                min += length;
            }
        }
        return {
            min: min,
            max: min + length
        };
    }
}

const RIGHT_NEIGBOUR_BY_DIRECTION = {};
RIGHT_NEIGBOUR_BY_DIRECTION[ROTATE.S] = new Vector(1, 0, 0);
RIGHT_NEIGBOUR_BY_DIRECTION[ROTATE.W] = new Vector(0, 0, -1);
RIGHT_NEIGBOUR_BY_DIRECTION[ROTATE.N] = new Vector(-1, 0, 0);
RIGHT_NEIGBOUR_BY_DIRECTION[ROTATE.E] = new Vector(0, 0, 1);