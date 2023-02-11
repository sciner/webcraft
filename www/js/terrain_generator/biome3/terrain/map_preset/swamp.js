import { ClimateParams } from "../manager_vars.js";
import { MapCellPreset_Mountains } from "./mountains.js";

export class MapCellPreset_Swamp extends MapCellPreset_Mountains {

    constructor() {
        super()
        this.id = 'swamp';
        this.max_height = -16;
        this.noise_scale = 8
        this.climate = new ClimateParams(.6, 1.25) // Болото
    }

}