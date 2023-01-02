import { BLOCK } from "./blocks.js";
import { ROTATE, Vector } from "./helpers.js";

export class ChestHelpers {

    // If block is a half-chest, it returns the expected position of the other half.
    // Otherwise it returns null.
    static getSecondHalfPos(block) {
        if (!block || block.material.name !== "CHEST") {
            return null;
        }
        const dir = BLOCK.getCardinalDirection(block.rotate);
        const dxz = RIGHT_NEIGBOUR_BY_DIRECTION[dir];
        switch (block.extra_data?.type) {
            case 'left':    return block.posworld.clone().subSelf(dxz);
            case 'right':   return block.posworld.clone().addSelf(dxz);
            default:        return null;
        }
    }

    // If there are two valid half-chests, and one of them has position pos,
    // it returns a descriptor of the other half. Otherwise it returns null.
    static getSecondHalf(world, pos) {
        const block = world.getBlock(pos);
        const secondPos = ChestHelpers.getSecondHalfPos(block);
        if (!secondPos) {
            return null;
        }
        const secondBlock = world.getBlock(secondPos);
        if (!secondBlock ||
            secondBlock.material.name !== "CHEST" ||
            secondBlock.extra_data?.type !== CHEST_HALF_OTHER_TYPE[block.extra_data.type] ||
            BLOCK.getCardinalDirection(secondBlock.rotate) !== BLOCK.getCardinalDirection(block.rotate)
        ) {
            return null;
        }
        return {
            pos: secondPos,
            block_id: secondBlock.id,
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

const CHEST_HALF_OTHER_TYPE = {
    'left': 'right',
    'right': 'left',
};

export const RIGHT_NEIGBOUR_BY_DIRECTION = {};
RIGHT_NEIGBOUR_BY_DIRECTION[ROTATE.S] = new Vector(1, 0, 0);
RIGHT_NEIGBOUR_BY_DIRECTION[ROTATE.W] = new Vector(0, 0, -1);
RIGHT_NEIGBOUR_BY_DIRECTION[ROTATE.N] = new Vector(-1, 0, 0);
RIGHT_NEIGBOUR_BY_DIRECTION[ROTATE.E] = new Vector(0, 0, 1);

/**
 * It tests whether a player is to far away to interct with a block, or both blocks.
 * It's not exactly like pickat, and uses a margin to avoid false negatives.
 */
export function isBlockRoughlyWithinPickatRange(player, margin, pos, pos2 = null) {
    const maxDist = player.game_mode.getPickatDistance() + margin;
    const eyePos = player.getEyePos();
    const blockCenter = new Vector(pos).addScalarSelf(0.5, 0.5, 0.5);
    if (eyePos.distance(blockCenter) <= maxDist) {
        return true;
    }
    if (pos2) {
        blockCenter.copyFrom(pos2).addScalarSelf(0.5, 0.5, 0.5);
        return eyePos.distance(blockCenter) <= maxDist;
    }
    return false;
}