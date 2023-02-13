import { ClimateParams } from "../manager_vars.js";
import { MapCellPreset_Mountains } from "./mountains.js";

export class MapCellPreset_SnowCoveredMountains extends MapCellPreset_Mountains {
    [key: string]: any;

    constructor() {
        super()
        this.id = 'snow_covered_mountains';
        this.max_height = 140;
        this.noise_scale = 32
        this.climate = new ClimateParams(-.8, .75) // Заснеженые горы
    }

}