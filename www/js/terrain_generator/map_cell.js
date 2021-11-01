export class MapCell {

    constructor(value, humidity, equator, biome, block) {
        this.value      = value;
        this.value2     = value;
        this.humidity   = Math.round(humidity * 100000) / 100000;
        this.equator    = Math.round(equator * 100000) / 100000;
        this.biome      = biome;
        this.block      = block;
    }

}