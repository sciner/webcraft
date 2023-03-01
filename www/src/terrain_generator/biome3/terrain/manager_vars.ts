import type { Vector } from "../../../helpers.js";

export const WATER_LEVEL = 79;

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
    id: string
    chance: float
    relief: float
    mid_level: float
    density_coeff: {
        d1: float
        d2: float
        d3: float
        d4: float
    }

    /**
     * @param id
     * @param options options
     * @param options.chance
     * @param options.relief кривизна рельефа
     * @param options.mid_level базовая высота поверхности относительно уровня моря
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
    d1: float;
    d2: float;
    d3: float;
    d4: float;
    density: float;
    fixed_density?: float;
    dcaves: float;
    in_aquifera: boolean;
    local_water_line: int;

    constructor(d1 : float, d2 : float, d3 : float, d4 : float, density : float, dcaves : float = 0, in_aquifera : boolean = false, local_water_line : int = WATER_LEVEL) {
        return this.set(d1, d2, d3, d4, density, dcaves, in_aquifera, local_water_line)
    }

    set(d1 : float, d2 : float, d3 : float, d4 : float, density : float, dcaves : float = 0, in_aquifera : boolean = false, local_water_line : int = WATER_LEVEL) {
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