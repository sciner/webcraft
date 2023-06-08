import type { Vector } from "../../../../helpers.js";
import { ClimateParams, WATER_LEVEL } from "../manager_vars.js";
import { MapCellPreset_Mountains } from "./mountains.js";

export class MapCellPreset_Swamp extends MapCellPreset_Mountains {
    [key: string]: any;

    prev_x = Infinity
    prev_z = Infinity
    mfn = null

    constructor() {
        super()
        this.id = 'swamp';
        this.max_height = -16;
        this.noise_scale = 8
        this.climate = new ClimateParams(.6, 1.25) // Болото
    }

    calcMaxHeight(xyz : Vector) : float {
        return xyz.y < WATER_LEVEL ? this.max_height / 20 : this.max_height
    }

}