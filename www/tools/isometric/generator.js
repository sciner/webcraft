import noise from '../../vendors/perlin.js';
import {Helpers} from '../../js/helpers.js';
import {makeSignal, lightHex, rgb2Hex, getCurvePoints} from './routines.js';

let canvas = document.getElementById('canvas3D');
let ctx = canvas.getContext('2d', { alpha: false });
canvas.width = window.innerWidth;
canvas.height = window.innerHeight ;

let canvas2D = document.getElementById('canvas2D');
let ctx2D = canvas2D.getContext('2d', { alpha: false });

// onmousemove
canvas2D.onmousemove = function(e) {
    let c = ctx2D.getImageData(e.offsetX, e.offsetY, 1, 1).data;
    let rgb = [c[0], c[1], c[2]];
    let hex = rgb2Hex(rgb);
    for(let code of Object.keys(BIOMES)) {
        let b = BIOMES[code];
        if(b.color == hex) {
            if(this.title != b.title) {
                this.title = b.title;
            }
        }
    }
}

const BIOMES                      = {};
BIOMES.OCEAN                      = {color: '#017bbb', title: 'ОКЕАН'};
BIOMES.BEACH                      = {color: '#ffdc7f', title: 'ПЛЯЖ'};
BIOMES.SCORCHED                   = {color: '#ff5500', title: 'ОБОГРЕВАЮЩИЙ'};
BIOMES.BARE                       = {color: '#cccccc', title: 'ПУСТОШЬ'};
BIOMES.TUNDRA                     = {color: '#74883c', title: 'ТУНДРА'};
BIOMES.TAIGA                      = {color: '#879b89', title: 'ТАЙГА'};
BIOMES.SNOW                       = {color: '#f5f5ff', title: 'СНЕГ'};
BIOMES.TEMPERATE_DESERT           = {color: '#f4a460', title: 'УМЕРЕННАЯ ПУСТЫНЯ'};
BIOMES.SHRUBLAND                  = {color: '#316033', title: 'КУСТАРНИКИ'};
BIOMES.GRASSLAND                  = {color: '#98a136', title: 'ТРАВЯНАЯ ЗЕМЛЯ'};
BIOMES.TEMPERATE_DECIDUOUS_FOREST = {color: '#228b22', title: 'УМЕРЕННЫЙ ЛИСТЫЙ ЛЕС'};
BIOMES.TEMPERATE_RAIN_FOREST      = {color: '#00755e', title: 'УМЕРЕННЫЙ ДОЖДЬ ЛЕС'};
BIOMES.SUBTROPICAL_DESERT         = {color: '#c19a6b', title: 'СУБТРОПИЧЕСКАЯ ПУСТЫНЯ'};
BIOMES.TROPICAL_SEASONAL_FOREST   = {color: '#008456', title: 'ТРОПИЧЕСКИЙ СЕЗОННЫЙ ЛЕС'};
BIOMES.TROPICAL_RAIN_FOREST       = {color: '#16994f', title: 'ТРОПИЧЕСКИЙ ЛЕС'};

// Print legend
for(let code of Object.keys(BIOMES)) {
    let b = BIOMES[code];
    document.getElementById('colorTable').insertAdjacentHTML('beforeend', '<div><span style="display: inline-block; width: 32px; height: 32px; background-color: ' + b.color + ';"></span> ' + b.title + '</div>');
}

// Terrain settings
let SX                      = 592038; // Стартовая координата X на карте
let SY                      = 91347; // Стартовая координата Y на карте
const SZ                    = 320; // Ширина и длина ргенерируемой области

let ww                      = window.innerWidth;
let wh                      = window.innerHeight;

const noisefn = noise.perlin2;
let signal = makeSignal(115, 20);

class Biome {

    // Draw
    draw(noisefn, signal, callback) {

        ctx.fillStyle = '#aaddff';
        ctx.fillRect(0, 0, ww, wh);
        
        let scale = .5;

        // Настройки
        const options = {
            WATER_LINE:             63, // Ватер-линия
            SCALE_EQUATOR:          1280 * scale, // Масштаб для карты экватора
            SCALE_BIOM:             640  * scale, // Масштаб для карты шума биомов
            SCALE_HUMIDITY:         320  * scale, // Масштаб для карты шума влажности
            SCALE_VALUE:            250  * scale // Масштаб шума для карты высот
        };

        for(let x = 0; x < SZ; x += 4) {
            for(let y = 0; y < SZ; y += 4) {

                const px = (SX - SZ / 2 + (SZ - x)); // * options.SCALE;
                const py = (SY - SZ / 2 + (y)); // * options.SCALE;

                // Влажность
                let humidity = Helpers.clamp(noisefn(px / options.SCALE_HUMIDITY, py / options.SCALE_HUMIDITY, 0) + 0.6, 0, 1);
                // Экватор
                let equator = Helpers.clamp(noisefn(px / options.SCALE_EQUATOR, py / options.SCALE_EQUATOR, 0) + 0.6, 0, 1);

                // Высота
                let value = (
                    noisefn(px / options.SCALE_VALUE, py / options.SCALE_VALUE, 0) + // равнины
                    noisefn(px / (options.SCALE_VALUE / 2), py / (options.SCALE_VALUE / 2), 0)
                    // noisefn(px / options.SCALE_BIOM, py / options.SCALE_BIOM, 0)
                ) / 2;

                // Шум биома
                let mh = Helpers.clamp(noisefn(px / (options.SCALE_VALUE * 8), py / (options.SCALE_VALUE * 8), 0) + 0.6, 0.1, 1);
                value *= (1. + mh / 2);

                if(value < 0) {
                    value /= 6;
                }
                value += 0.2;
                value = parseInt(value * 255) + 4;
                value = Helpers.clamp(value, 4, 255);
                value = signal[value];

                let biome = this.getBiome(value / 255, humidity, equator);

                if(biome == 'OCEAN') {
                    value = options.WATER_LINE;
                }

                //
                let i = (ww / 2 + SZ / 2) - (y - x);
                let j = (wh / 2 - SZ / 4) + (x + y) / 2;

                if(x >= SZ - 4 || y >= SZ - 4) {
                    ctx.fillStyle = lightHex(BIOMES[biome].color, value / 255);
                    ctx.fillRect(i / 1.5, (j - value) / 1.5, 3, value);
                } else {
                    ctx.fillStyle = lightHex(BIOMES[biome].color, value / 255 * 2);
                    // ctx.fillStyle = BIOMES[biome].color;
                    ctx.fillRect(i / 1.5, (j - value) / 1.5, 3, value);
                }

                //
                ctx2D.fillStyle = BIOMES[biome].color;
                // ctx2D.fillStyle = rgb2Hex([value, value, value]);
                ctx2D.fillRect(Math.floor(x / SZ * 320), Math.floor(y / SZ * 320), 4, 4);

            }

        }

    }

    // Redraw
    redraw() {
        let t = performance.now();
        this.draw(noisefn, signal);
        // Draw signal modify table
        ctx2D.fillStyle = '#00000077';
        for(let i in signal) {
            let value = signal[i];
            ctx2D.fillRect((i / 256) * 320, 320 - (value / 256) * 320, 2, 2);
        }
        ctx2D.fillStyle = '#dd2200';
        ctx2D.fillRect(158, 158, 4, 4);
        document.getElementById('timer').innerText = Math.round(performance.now() - t) + ' ms';
        SX += SZ / 50;
    }

    /**
    * Функция определения биома в зависимости от возвышенности, влажности и отдаленности от экватора
    */
    getBiome(height, humidity, equator) {
        let h = height;
        let m = humidity;
        /*
        if(equator > .7) {
            if (equator < .9) return 'OCEAN';
            if (equator < .92 && humidity < .5) return 'TUNDRA';
            return 'SNOW';
        }
        */
        // if (h < 0.1) return 'OCEAN';
        // if (h < 0.12) return 'BEACH';
        if (h < 0.248) return 'OCEAN';
        if (h < 0.255) return 'BEACH';
        if (h > 0.8) {
            if (m < 0.1) return 'SCORCHED';
            if (m < 0.2) return 'BARE';
            if (m < 0.5) return 'TUNDRA';
            return 'SNOW';
        }
        if (h > 0.6) {
            if (m < 0.33) return 'TEMPERATE_DESERT'; // УМЕРЕННАЯ ПУСТЫНЯ
            if (m < 0.66) return 'SHRUBLAND'; // кустарник
            return 'TAIGA';
        }
        if (h > 0.3) {
            if (m < 0.16) return 'TEMPERATE_DESERT'; // УМЕРЕННАЯ ПУСТЫНЯ
            if (m < 0.50) return 'GRASSLAND';
            if (m < 0.83) return 'TEMPERATE_DECIDUOUS_FOREST'; // УМЕРЕННЫЙ ЛИСТЫЙ ЛЕС
            return 'TEMPERATE_RAIN_FOREST'; // УМЕРЕННЫЙ ДОЖДЬ ЛЕС
        }
        if (m < 0.16) return 'SUBTROPICAL_DESERT';
        if (m < 0.33) return 'GRASSLAND';
        if (m < 0.66) return 'TROPICAL_SEASONAL_FOREST';
        return 'TROPICAL_RAIN_FOREST';
    }

}

let biome = new Biome();
biome.redraw();

setInterval(function() {
    biome.redraw();
}, 150);
