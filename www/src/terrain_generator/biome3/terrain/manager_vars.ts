import type { Vector } from "../../../helpers.js";

export const WATER_LEVEL = 80;

export const TREE_BETWEEN_DIST          = 2; // минимальное расстояние между деревьями
export const TREE_MARGIN                = 3; // Минимальное расстояние от сгенерированной постройки до сгенерированного дерева
export const MAX_TREES_PER_CHUNK        = 16; // Максимальное число деревьев в чанке
export const TREE_MIN_Y_SPACE           = 5; // Минимальное число блоков воздуха для посадки любого типа дерева
export const TREE_PLANT_ATTEMPTS        = 8; // Количество попыток посадить в чанке деревья
export const BUILDING_MIN_Y_SPACE       = 10; // Минимальное число блоков воздуха для установки дома
export const DENSITY_AIR_THRESHOLD      = .6; // всё что больше этого значения - камень
export const UNCERTAIN_ORE_THRESHOLD    = .025;

export const GENERATOR_OPTIONS = {
    WATER_LEVEL:            WATER_LEVEL, // Ватер-линия
    SCALE_EQUATOR:          1280 * .5 * 3, // Масштаб для карты экватора
    SCALE_BIOM:             640  * .5, // Масштаб для карты шума биомов
    SCALE_HUMIDITY:         320  * .5, // Масштаб для карты шума влажности
    SCALE_VALUE:            250  * .5 // Масштаб шума для карты высот
}

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