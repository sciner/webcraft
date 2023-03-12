import {DEFAULT_TX_CNT} from "../constant.js";
import {CubeSym} from "../core/CubeSym.js";

export const TX_CNT = DEFAULT_TX_CNT;

export enum ROTATE {
    S = CubeSym.ROT_Y2, // front, z decreases
    W = CubeSym.ROT_Y,  // left, x decreases
    N = CubeSym.ID,     // back, z increases
    E = CubeSym.ROT_Y3, // right, x increases
}

export enum CAMERA_MODE {
    COUNT               = 3,
    SHOOTER             = 0,
    THIRD_PERSON        = 1,
    THIRD_PERSON_FRONT  = 2,
}

export enum QUAD_FLAGS {
    NORMAL_UP                   = 1 << 0,
    MASK_BIOME                  = 1 << 1,
    NO_AO                       = 1 << 2,
    NO_FOG                      = 1 << 3,
    FLAG_ANIMATED               = 1 << 5,
    FLAG_TEXTURE_SCROLL         = 1 << 6,
    NO_CAN_TAKE_AO              = 1 << 7,
    QUAD_FLAG_OPACITY           = 1 << 8,
    QUAD_FLAG_SDF               = 1 << 9,
    NO_CAN_TAKE_LIGHT           = 1 << 10,
    FLAG_MULTIPLY_COLOR         = 1 << 11,
    FLAG_LEAVES                 = 1 << 12,
    FLAG_ENCHANTED_ANIMATION    = 1 << 13,
    FLAG_RAIN_OPACITY           = 1 << 14,
    FLAG_MASK_COLOR_ADD         = 1 << 15,
    FLAG_TORCH_FLAME            = 1 << 16,
    //all below are vertex-only flags!
    DELIMITER_VERTEX            = (1 << 17) - 1,
    FLAG_WAVES_VERTEX           = 1 << 17,
    LOOK_AT_CAMERA              = 1 << 18,
    LOOK_AT_CAMERA_HOR          = 1 << 19,
    FLAG_TRIANGLE               = 1 << 20,
    FLAG_MIR2_TEX               = 1 << 21,
    NEXT_UNUSED_FLAG            = 1 << 22,
}

// Direction enumeration
export enum DIRECTION {
    UP        = CubeSym.ROT_X,
    DOWN      = CubeSym.ROT_X3,
    LEFT      = CubeSym.ROT_Y,
    RIGHT     = CubeSym.ROT_Y3,
    FORWARD   = CubeSym.ID,
    BACK      = CubeSym.ROT_Y2,
    // Aliases
    WEST      = CubeSym.ROT_Y, // left
    EAST      = CubeSym.ROT_Y3, // right
    NORTH     = CubeSym.ID, // forward
    SOUTH     = CubeSym.ROT_Y2, // back
}

export enum DIRECTION_BIT {
    UP    = 0,
    DOWN  = 1,
    EAST  = 2, // X increases
    WEST  = 3, // X decreases
    NORTH = 4, // Z increases
    SOUTH = 5, // Z decreases
}

// Direction names
export enum DIRECTION_NAME {
    up        = DIRECTION.UP as int,
    down      = DIRECTION.DOWN as int,
    left      = DIRECTION.LEFT as int,
    right     = DIRECTION.RIGHT as int,
    forward   = DIRECTION.FORWARD as int,
    back      = DIRECTION.BACK as int,
}
