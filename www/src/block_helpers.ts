import { BLOCK } from "./blocks.js";
import { ITEM_LABEL_MAX_LENGTH } from "./constant.js";
import { ROTATE, Vector, ObjectHelpers } from "./helpers.js";

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

export class ItemHelpers {

    /**
     * Validates and possibly changes (possibly to null) a label entered by a user.
     * @return {?String} a valid value for label that can be passed to {@link setLabel}
     * @throws if the string can't be used as label
     * @todo better validation
     */
    static validateAndPreprocessLabel(label) {
        // validate the label (it's for the server; the client validates before that)
        if (typeof label !== 'string' ||
            label.length > ITEM_LABEL_MAX_LENGTH
        ) {
            throw `error_incorrect_value|label=${label}`
        }
        label = label.trim(); 
        return label !== '' ? label : null;
    }

    static getLabel(item) {
        return item.extra_data?.label ?? BLOCK.fromId(item.id).title;
    }
    
    static setLabel(item, label) {
        this.setExtraDataField(item, 'label', label);
    }

    static setExtraDataField(item, fieldName, value) {
        if (value != null) {
            item.extra_data = item.extra_data ?? {};
            item.extra_data[fieldName] = value;
        } else {
            this.deleteExtraDataField(item, fieldName);
        }
    }

    static deleteExtraDataField(item, fieldName) {
        if (item.extra_data) {
            delete item.extra_data[fieldName];
            if (ObjectHelpers.isEmpty(item.extra_data)) {
                delete item.extra_data;
            }
        }
    }

    /** @return the existing value, or the newly set value */
    static getOrSetExtraDataField(item, fieldName, defaultValue) {
        const ex = item.extra_data && item.extra_data[fieldName];
        if (ex != null) {
            return ex;
        }
        if (typeof defaultValue === 'function') {
            defaultValue = defaultValue();
        }
        this.setExtraDataField(item, fieldName, defaultValue);
        return defaultValue;
    }

    /** @return the existing value of type Object, or the newly set {} value */
    static getOrSetExtraDataFieldObject(item, fieldName) {
        item.extra_data = item.extra_data ?? {};
        let result = item.extra_data[fieldName];
        if (!result) {
            item.extra_data[fieldName] = result = {};
        }
        return result;
    }

    static incrementExtraDataField(item, fieldName, delta = 1) {
        item.extra_data = item.extra_data ?? {};
        item.extra_data[fieldName] = (item.extra_data[fieldName] ?? 0) + delta;
    }
}