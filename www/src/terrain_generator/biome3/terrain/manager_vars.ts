import type { Vector } from "../../../helpers";

export const WATER_LEVEL = 80;

export class ClimateParams {

    temperature: float = 0
    humidity : float = 0

    /**
     */
    constructor(temperature : float = 0, humidity : float = 0) {
        this.set(temperature, humidity)
    }

    /**
     */
    set(temperature : float = 0, humidity : float = 0) {
        this.temperature = temperature
        this.humidity = humidity
    }

}

export class MapCellPreset {
    [key: string]: any;

    /**
     * @param {string} id
     * @param {object} options options
     * @param {float} options.chance
     * @param {float} options.relief кривизна рельефа
     * @param {float} options.mid_level базовая высота поверхности относительно уровня моря
     */
    constructor(id: string, {chance, relief, mid_level}) {
        this.id = id;
        this.chance = chance;
        this.relief = relief;
        this.mid_level = mid_level;
    }

    /**
     */
    modifyClimate(xz : Vector, params : ClimateParams) : boolean {
        return false
    }

}

//
export class DensityParams {
    [key: string]: any;

    /**
     * @param {float} d1
     * @param {float} d2
     * @param {float} d3
     * @param {float} d4
     * @param {float} density
     * @param {float} dcaves
     * @param {boolean} in_aquifera
     * @param {int} local_water_line
     */
    constructor(d1, d2, d3, d4, density, dcaves = 0, in_aquifera = false, local_water_line = WATER_LEVEL) {
        return this.set(d1, d2, d3, d4, density, dcaves, in_aquifera, local_water_line)
    }

    /**
     * @param {float} d1
     * @param {float} d2
     * @param {float} d3
     * @param {float} d4
     * @param {float} density
     * @param {float} dcaves
     * @param {boolean} in_aquifera
     * @param {int} local_water_line
     */
    set(d1, d2, d3, d4, density, dcaves = 0, in_aquifera = false, local_water_line = WATER_LEVEL) {
        this.d1 = d1;
        this.d2 = d2;
        this.d3 = d3;
        this.d4 = d4;
        this.density = density;
        this.fixed_density = null;
        this.dcaves = dcaves || 0;
        this.in_aquifera = !!in_aquifera
        this.local_water_line = local_water_line ?? WATER_LEVEL
        return this;
    }

    reset() {
        return this.set(0, 0, 0, 0, 0, 0);
    }

}