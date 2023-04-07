//@ts-check
import { Mth, Vector } from "./helpers.js";
import { Resources } from "./resources.js";
import { Weather } from "./block_type/weather.js";
import type { Renderer } from "./render.js";
import type { CubeMesh } from "./renders/BaseRenderer.js";

export declare type IFogPreset = {
    color:          [number,number, number, number ] | Gradient | Color | IAnyColorRecordMap,
    addColor:       [number,number, number, number ] | Gradient | Color | number | IAnyColorRecordMap,
    density:        number,
    illuminate? :   number,
}

export const PRESET_NAMES = {
    NORMAL: 'normal',
    WATER: 'water',
    LAVA: 'lava',
    NETHER_PORTAL: 'nether_portal'
}

const HORIZON_BRIGHTNESS_MIN_DEPTH = 2;
const HORIZON_BRIGHTNESS_MAX_DEPTH = 8;
const HORIZON_MAX_BRIGHTNES_PER_SECOND = 0.5;

export class FogPreset {
    [key: string]: any;

    /**
     * @param {IFogPreset} [fogPreset]
     */
    constructor(fogPreset = null) {
        this.color    = new Color();
        this.addColor = new Color();
        this.density  = 0;
        this.illuminate = 0;

        this.hasAddColor = false;
        this.addColorAlpha = 1;

        /**
         * @type {IFogPreset}
         */
        this._preset = null;

        this._lastEvalFactor = -1;

        this.set(fogPreset);
    }

    /**
     *
     * @param {number} factor
     * @returns
     */
    eval(factor = 0) {
        return this._eval(factor);
    }

    _eval(factor = 0) {
        factor = Mth.clamp(factor, 0, 1);

        if (!this.preset){
            this._lastEvalFactor = factor;
            return;
        }

        /*
        if (Math.abs(factor - this._lastEvalFactor) < 0.001) {
            return;
        }*/

        this._lastEvalFactor = factor;

        this.color.copy(this.preset.color.toColor(factor));

        if (this.hasAddColor) {
            this.addColor.copy(this.preset.addColor.toColor(factor));
        } else {
            this.addColor.copy(this.color);
            this.addColor.mulAlpha(this.addColorAlpha);
        }

        this.density    = this.preset.density;
        this.illuminate = this.preset.illuminate || 0;

        return this;
    }

    /**
     *
     * @param {IFogPreset} fogPreset
     */
    set(fogPreset) {
        if (!fogPreset) {
            this.preset = null;
            this.hasAddColor = false;
            this.addColorAlpha = 1;

            return this._eval(0);
        }

        const {
            color,
            addColor,
            density,
            ...other
        } = fogPreset;

        this.hasAddColor = addColor != null && typeof addColor !== 'number';

        if (!this.hasAddColor) {
            this.addColorAlpha = addColor || 1;
        }

        this.preset = {
            color   : new Gradient(color),
            addColor: this.hasAddColor ? new Gradient(addColor) : addColor,
            density : density,
            ...other
        };

        this._eval(0);
    }

    /**
     *
     * @param {FogPreset} target
     * @param {number} iterFactor interpolate factor between presets
     * @param {number} [evalFactor] evaluate factor iternally for eval presets values
     * @param {FogPreset} [out]
     */
    lerpTo (target, iterFactor = 0, evalFactor = null, out = new FogPreset(null)) {
        if (evalFactor == null) {
            evalFactor = this._lastEvalFactor;
        }

        this.eval(evalFactor);
        target.eval(evalFactor);

        this.color.lerpTo(target.color, iterFactor, out.color);
        this.addColor.lerpTo(target.addColor, iterFactor, out.addColor);

        out.density    = Mth.lerp(iterFactor, this.density, target.density);
        out.illuminate = Mth.lerp(iterFactor, this.illuminate, target.illuminate);

        return out;
    }

    copy(from) {
        return this.set(from.preset);
    }

    clone() {
        return new FogPreset(this.preset);
    }
}

export class Color {
    [key: string]: any;
    /**
     *
     * @param {number | Color | Array<number> } anyData
     * @param {number} [alpha]
     */
    constructor (anyData: number | Color | number[] = 0, alpha = 1, pma = false) {
        this._raw = new Float32Array(4);
        this._pma = pma;

        this.set(anyData, alpha);
    }

    mulAlpha(alpha = 1) {
        if (this._pma) {
            this._raw[0] *= alpha;
            this._raw[1] *= alpha;
            this._raw[2] *= alpha;
        }
        this._raw[3] *= alpha;

        return this;
    }

    lum() {
        return luminance(this._raw);
    }

    set (anyData: number | Color | number[], alpha = 1) {

        if (!Color.isColorLike(anyData)) {
            return this;
        }

        if (anyData instanceof Color) {
            return this.copy(anyData);
        }

        let r = 0;
        let g = 0;
        let b = 0;

        alpha = Mth.clamp(alpha, 0, 1);

        if (typeof anyData === 'number') {
            r = ((anyData >> 16) & 0xff) / 0xff;
            g = ((anyData >> 8) & 0xff) / 0xff;
            b = ((anyData >> 0) & 0xff) / 0xff;
        } else if (Array.isArray(anyData)) {
            r = anyData[0];
            g = anyData[1];
            b = anyData[2];
            alpha = Mth.clamp(anyData[3] == null? 1 : anyData[3], 0, 1) * alpha;
        }

        if(this._pma) {
            r *= alpha;
            g *= alpha;
            b *= alpha;
        }

        this._raw.set([r, g, b, alpha]);

        return this;
    }

    /**
     * @param {Color} target
     * @param {number} factor
     * @param {Color } out
     */
    lerpTo (target, factor = 0, out = new Color()) {
        factor = Mth.clamp(factor, 0, 1);

        if (target._pma !== this._pma) {
            throw new Error('[Color] Botch color should use same PMA mode');
        }

        const targetColor = target.toArray();

        out._pma = this._pma;

        // color
        out._raw[0] = this._raw[0] * (1 - factor) + targetColor[0] * factor;
        out._raw[1] = this._raw[1] * (1 - factor) + targetColor[1] * factor;
        out._raw[2] = this._raw[2] * (1 - factor) + targetColor[2] * factor;
        out._raw[3] = this._raw[3] * (1 - factor) + targetColor[3] * factor;

        return out;
    }

    toArray() {
        return this._raw;
    }

    /**
     * @param {Color} from
     * @returns
     */
    copy(from) {
        this._raw.set(from._raw);
        this._pma = from._pma;

        return this;
    }

    clone() {
        return new Color().copy(this);
    }

    static isColorLike(target): target is Color {
        if (target instanceof Color) {
            return true;
        }

        if (typeof target === 'number') {
            return true;
        }

        if (Array.isArray(target) && (target.length === 3 || target.length === 4)) {
            return true;
        }

        return false;
    }

}

interface IAnyColorRecordMap {
    [key: number]: number | Color | Array<number>
}

interface IAnyColorRecord {
    pos: number;
    color: number | Color | number[];
}

interface IColorRecord {
    pos: number;
    color: Color;
}


export class Gradient {
    [key: string]: any;
    /**
     *
     * @param {IAnyColorRecordMap| Array<IAnyColorRecord> | Gradient | Color} gradData
     */
    constructor (gradData = new Color()) {
        this._color = new Color();
        this._raw = this._color._raw;

        /**
         * @type {IColorRecord[]}
         */
        this._grad = [];

        this._lastEvalFactor = -1;

        this.set(gradData);

        this._eval(0);
    }

    /**
     *
     * @param {{[key: number]: number | Color | Array<number>} | Array<IAnyColorRecord> | Gradient | Color} gradData
     */
    set(gradData: {[key: number]: number | Color | Array<number>} | Array<IAnyColorRecord> | Gradient | Color) {
        if (gradData instanceof Gradient) {
            return this.copy(gradData);
        }

        if (Color.isColorLike(gradData)) {
            this._grad = [{
                color: new Color(gradData),
                pos: 0
            }];
            return;
        }

        if (Array.isArray(gradData)) {
            this._grad = gradData.map((e) => ({pos: e.pos, color: new Color(e.color)}));
            return;
        }

        this._grad = Object
            .entries(gradData)
            .map(([key, color]) => ({pos: +key / 100, color: new Color(color)}));

        return this;
    }

    _eval(factor = 0) {
        if (this._grad.length <= 1) {
            this._color.copy(this._grad[0].color);
            this._lastEvalFactor = 0;
            return this;
        }

        factor = Mth.clamp(factor, 0, 1);


        /*
        if (Math.abs(this._lastEvalFactor - factor) <= 1 / ((this._grad.length - 1) * 256)) {
            return;
        }*/

        this._lastEvalFactor = factor;

        let rightKey = this._grad[0];
        let leftKey = this._grad[0];

        /**
         * @todo lookup cache
         */
        for(const entry of this._grad) {
            rightKey = entry;

            if (rightKey.pos >= factor) {
                break;
            }

            leftKey = entry;
        }

        let relative = 0;

        if (leftKey !== rightKey) {
            relative = (factor - leftKey.pos) / (rightKey.pos - leftKey.pos);
        }

        return leftKey.color.lerpTo(rightKey.color, relative, this._color);
    }

    toArray(factor = -1) {
        if (factor > 0) {
            this._eval(factor);
        }

        return this._raw;
    }

    toColor(factor = -1) {
        if (factor > 0) {
            this._eval(factor);
        }

        return this._color;
    }

    /**
     *
     * @param {Gradient} from
     */
    copy(from) {
        return this.set(from._grad);
    }

    clone() {
        return new Gradient(this._grad);
    }
}

function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
}

function easeOutExpo(x) {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function luminance (color) {
    const r = color[0]
    const g = color[1];
    const b = color[2];

    return  Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b );
}

class InterpolateTask {
    [key: string]: any;
    constructor({
        from,
        to,
        duration,
        ease = null,
        context,
        name = ''
    }) {
        this.name = name;
        this.from = from;
        this.to = to;
        this.ease = ease || ((x) => x);
        this.dur = duration;
        this.context = context;

        this.value = context ? context[name] : null;
        this.t = 0;
        this.update(0);
    }

    get done() {
        return this.t >= 1;
    }

    _eval (factor) {
        return Mth.lerpComplex(this.from, this.to, factor, this.value);
    }

    update(delta = 0) {
        if (this.t >= 1) {
            return;
        }

        this.t += delta / this.dur;

        const lim = this.ease(Mth.clamp(this.t, 0, 1));

        this.value = this._eval (lim);

        if (this.context) {
            this.context[this.name] = this.value;
        }
    }
}

class PresetInterpolationTask extends InterpolateTask {
    [key: string]: any;
    _eval (factor) {
        const sunFactor = this.context ? this.context._sunFactor : 1;
        return this.from.lerpTo(this.to, factor, sunFactor, this.value || new FogPreset());
    }
}

// fog not use alpha, we can set it for addColor
// addColor will be interpolated with alpha
// alpha is used for cool effect
const ENV_GRAD_COLORS = {
    [0]  : new Color(0x020202, 0),
    [35] : new Color(0x250a07, 0.15),
    [46] : new Color(0xffa866 /*0x963b25*/, 0.25),
    [57] : new Color(0xe3ad59, 0.0),
    [62] : new Color(0xbdd7ea, 0.0), // as fog
    [100]: new Color(0xbdd7ea, 0.0), // as fog
};

export const FOG_PRESETS = {
    [PRESET_NAMES.NORMAL]: {
        color: ENV_GRAD_COLORS,
        addColor: [0, 0, 0, 0],
        density: 2.52 / 320,
    },

    [PRESET_NAMES.WATER]: {
        color: [55 / 255, 100 / 255, 230 / 255, 0],
        addColor: [40 / 255, 40 / 255, 120 / 255, 0.45],
        density: 0.1,
        illuminate: 0.1,
    },

    [PRESET_NAMES.LAVA]: {
        color: [255 / 255, 100 / 255, 20 / 255, 0.4],
        addColor: [255 / 255, 100 / 255, 20 / 255, 0.45],
        density: 0.5,
        illuminate: 0.5,
    },

    [PRESET_NAMES.NETHER_PORTAL]: {
        color: [70 / 255, 30 / 255, 150 / 255, 0.4],
        addColor: [70 / 255, 30 / 255, 150 / 255, 0.45],
        density: 0.5,
        illuminate: 0.5,
    }

};

export const SETTINGS = {
    fog:                    'base', //for preset
    fogDensity:             1, // multiplication
    fogDensityUnderWater:   0.1,
    chunkBlockDist:         8,
    interpoateTime:         300,
};

export class Environment {
    
    static presets : {[key: string]: FogPreset} = {}
    static _fogDirty: boolean = false

    skyBox :                CubeMesh
    context:                Renderer;
    rawInterpolatedFog:     number[];
    rawInterpolatedFogAdd:  number[];
    interpolatedClearValue: number[];
    fogDensity:             number;
    chunkBlockDist:          number;
    sunDir:                 number[];
    brightness:             number;
    nightshift:             number;
    _skyColor:              number[];
    horizonBrightness:      number;
    hbLastPos:              Vector;
    hbLastTime:             number;
    deepDarkMode:           string;
    _currentPresetName:     string;
    _fogInterpolationTime:  number;
    _computedFogRaw:        number[];
    _computedBrightness:    number;
    _sunFactor:             number;
    _tasks:                 Map<any, any>;
    _interpolationRun:      boolean;
    _interpolatedPreset:    any;
    _refLum:                any;

    constructor(context : Renderer) {
        this.context = context;

        this.rawInterpolatedFog      = [0 ,0 ,0, 0];
        this.rawInterpolatedFogAdd   = [0 ,0 ,0, 0];
        this.interpolatedClearValue  = [0, 0, 0, 1]; // same as fog, but include brightness internally and always has alpha 1

        for(const [key, value] of Object.entries(FOG_PRESETS)) {
            Environment.registerFogPreset(key, value as IFogPreset)
        }

        this.fogDensity = SETTINGS.fogDensity;
        this.chunkBlockDist = SETTINGS.chunkBlockDist;
        this.sunDir = [0.9593, 1.0293, 0.6293];
        this.brightness = 1.;
        this.nightshift = 1.; // it's 1 above the surface, and 0 deep beow
        this._skyColor = [0, 0, 0];

        // similar to nightshift, but based on estimated depth
        this.horizonBrightness = 1;
        this.hbLastPos = new Vector() // used for temporal smoothing;
        this.hbLastTime = -Infinity;
        this.deepDarkMode = 'auto';

        this.skyBox = null;

        this._currentPresetName = PRESET_NAMES.NORMAL;
        this._fogInterpolationTime = 0;

        /***
         * @type {FogPreset}
         */
        this._interpolatedPreset = null;

        this._refLum = Environment.presets[PRESET_NAMES.NORMAL].eval(1).color.lum();

        // fog color before apply brightness factor
        this._computedFogRaw = [0,0,0,0];

        this._computedBrightness = 1;

        // this._fogDirty = false;

        // 0 - horizontal, 1 - top
        this._sunFactor = 1;

        this._tasks = new Map();
        this._interpolate(0);
    }

    static registerFogPreset(preset_id : string, preset : IFogPreset) {
        Environment.presets[preset_id] = new FogPreset(preset);
    }

    static replacePresetColor(preset_name : string, color : any | null) {
        if(color) {
            const p = FOG_PRESETS[preset_name]
            color.divideScalarSelf(255)
            p.color[0] = color.r
            p.color[1] = color.g
            p.color[2] = color.b
            p.addColor[0] = color.r
            p.addColor[1] = color.g
            p.addColor[2] = color.b
            Environment.presets[preset_name] = new FogPreset(p)
            Environment._fogDirty = true
        }
    }

    get fullBrightness() {
        return this.brightness * this.nightshift * this._computedBrightness;
    }

    /**
     * @returns {FogPreset}
     */
    get fogPresetRes() {
        const p = Environment.presets[this._currentPresetName];

        return this._tasks.has('_interpolatedPreset')
            ? this._interpolatedPreset || p
            : p;
    }

    /**
     * Return actual used fog
     */
    get fogPreset() {
        return this._currentPresetName;
    }

    /**
     * Set fog preset state
     */
    set fogPreset(v) {
        if (!(v in Environment.presets)) {
            v = PRESET_NAMES.NORMAL;
        }

        if (v === this._currentPresetName) {
            return;
        }

        const from = this._currentPresetName;

        this._currentPresetName = v;
        Environment._fogDirty = true;

        this._runInterpolation('_interpolatedPreset', Environment.presets[from], Environment.presets[v]);
        this._interpolationRun = true;
    }

    get time() {
        return performance.now();
    }

    /**
    * State relative color interpolated with brightness, time and underwater knowledge
    */
    get actualFogColor() {
        return this.rawInterpolatedFog;
    }

    /**
     * @param {Renderer} render
     */
    init (render : Renderer) {
        const  {
            renderBackend
        }  = render;

        this.skyBox = renderBackend.createCubeMap({
            code: Resources.codeSky,
            uniforms: {
                u_brightness: 1.0,
                u_nightshift: 0,
                u_baseColor: [0, 0, 0]
                // u_textureOn: true
            },
            /*sides: [
                Resources.sky.posx,
                Resources.sky.negx,
                Resources.sky.posy,
                Resources.sky.negy,
                Resources.sky.posz,
                Resources.sky.negz
            ]*/
        });
    }

    setBrightness(value) {
        if (value === this.brightness) {
            return;
        }

        this.brightness = value;
        Environment._fogDirty = true;
    }

    /**
     * @todo Atm we can't use computed sun and state interpolation
     * Fix this case
     */
    _computeFogRelativeSun() {
        const world       = this.context.world;
        const dayTimeTics = 24000;
        const gameTime = world?.getTime();

        // in secs
        let dayTime = dayTimeTics / 2; // default

        if (gameTime) {
            dayTime = gameTime.time_visible;
        }

        const phase = Math.PI * 2 * dayTime / dayTimeTics;

        this.sunDir = [
            Math.sin(phase),
            -Math.cos(phase),
            0
        ];

        // up vector only is Y
        const factor =  Mth.clamp(0.5 * (1. + this.sunDir[1]), 0, 1);

        this._sunFactor = factor;

        Environment._fogDirty = true;
    }

    _runInterpolation(key, from, to) {
        const old = this._tasks.get(key);

        if (old) {
            from = old.value;
            this._tasks.delete(key);
        }

        if (from == to) {
            return;
        }

        const taskCtor = from instanceof FogPreset
            ? PresetInterpolationTask
            : InterpolateTask;

        const task = new taskCtor({
            from,
            to,
            duration: SETTINGS.interpoateTime,
            ease: easeOutCubic,
            name: key,
            context: this
        });

        this._tasks.set(key, task);
    }

    _taskDone(task) {
        const t = task;

        this._tasks.delete(t.name);

        this[t.name] = t.value;
    }

    _interpolate(delta = 0) {
        for(const t of this._tasks.values()) {
            t.update(delta);

            if (t.done) {
                this._taskDone(t);
            }
            Environment._fogDirty = true;
        }
    }

    updateDeepHorizon() {
        const groundLevelEastimtion = Qubatch.world.chunkManager.groundLevelEastimtion;
        const player = Qubatch.player;

        var disabled = player.eyes_in_block?.is_water;
        if (this.deepDarkMode === 'auto') {
            disabled |= player.game_mode.isSpectator();
        } else if (this.deepDarkMode === 'off') {
            disabled = true;
        }
        if (disabled || groundLevelEastimtion == null) {
            this.horizonBrightness = this.nightshift;
            if (disabled) {
                // when it becomes enabled, it's instant.
                this.hbLastTime = -Infinity;
            }
            return;
        }
        // calculate brightness based on depth
        const playerPos = player.pos;
        var elevation = playerPos.y - groundLevelEastimtion;
        var newHorizonBrightness = Mth.lerpAny(elevation,
            -HORIZON_BRIGHTNESS_MIN_DEPTH, 1,
            -HORIZON_BRIGHTNESS_MAX_DEPTH, 0);
        newHorizonBrightness = Math.min(newHorizonBrightness, this.nightshift);
        // temporal smoothing (helps when many chunks change quickly)
        const maxDelta = this.hbLastPos.distance(playerPos) < 10
            ? (performance.now() - this.hbLastTime) * 0.001 * HORIZON_MAX_BRIGHTNES_PER_SECOND
            : Infinity;
        var delta = newHorizonBrightness - this.horizonBrightness;
        delta = Math.max(Math.min(delta, maxDelta), -maxDelta);
        this.horizonBrightness += delta;

        this.hbLastPos.copyFrom(playerPos);
        this.hbLastTime = performance.now();
    }

    /**
     * Interpolates a weather-based value between the clear weather and the current strength of the rainy/snowy weather.
     * @param {Function} getWeatherValue takes a weather, returns the value from that weather
     */
    lerpWeatherValue(getWeatherValue) {
        const clearValue = getWeatherValue(Weather.CLEAR)
        const rain = Qubatch.render.rain
        const rainWeather = rain?.weather
        return rainWeather
            ? Mth.lerp(rain.strength_val, clearValue, getWeatherValue(rainWeather))
            : clearValue
    }

    updateFogState() {
        if (!Environment._fogDirty) {
            return;
        }

        this.updateDeepHorizon();

        const weather = Qubatch.render.getWeather();

        const p = this.fogPresetRes;

        p.eval(this._sunFactor);

        const fogColor = p.color.toArray();
        const fogAdd = p.addColor.toArray();

        // we use computed preset as base
        // compute brightness realtive it
        const base = Environment.presets[PRESET_NAMES.NORMAL];

        base.eval(this._sunFactor);

        const lum = easeOutExpo( Mth.clamp((-1 + 2 * this._sunFactor) * 0.8 + 0.2, 0, 1)) ;// base.color.lum() / this._refLum;

        this._computedBrightness = lum * this.lerpWeatherValue(weather => Weather.GLOBAL_BRIGHTNESS[weather]);

        const value = this.brightness * lum * this.lerpWeatherValue(weather => Weather.FOG_BRIGHTNESS[weather]);;
        const mult = Math.max(p.illuminate, Math.min(1, value * 2) * this.horizonBrightness * value);

        for (let i = 0; i < 3; i ++) {
            this.rawInterpolatedFog[i]     = fogColor[i] * mult;
            this.interpolatedClearValue[i] = fogColor[i] * mult;

            this.rawInterpolatedFogAdd[i]  = fogAdd[i];
        }

        this.rawInterpolatedFog[3]     = fogColor[3];
        this.rawInterpolatedFogAdd[3]  = fogAdd[3];
        this.interpolatedClearValue[3] = 1;

        Environment._fogDirty = false;
    }

    setEnvState ({
        fogDensity = this.fogDensity,
        chunkBlockDist = this.chunkBlockDist,
        nightshift = this.nightshift,
        preset = this._currentPresetName,
        brightness = this.brightness
    }) {
        if (this.nightshift !== nightshift) {
            Environment._fogDirty = true;
        }
        this.nightshift = nightshift;

        if (this.fogDensity !== this.fogDensity) {
            Environment._fogDirty = true;
        }
        this.fogDensity = fogDensity;

        if (!isFinite(chunkBlockDist)) {
            chunkBlockDist = 10000 * Math.sign(chunkBlockDist);
        }

        if (this.chunkBlockDist !== chunkBlockDist) {
            Environment._fogDirty = true;
            this._runInterpolation('chunkBlockDist', this.chunkBlockDist, chunkBlockDist);
        }
        this.chunkBlockDist = chunkBlockDist;

        this.setBrightness(brightness);

        this.fogPreset = preset;
    }

    update (delta, args) {
        this._computeFogRelativeSun();
        this._interpolate(delta);
        this.updateFogState();
    }

    /**
     * Sync environment state with uniforms
     * @param {GlobalUniformGroup} gu
     */
    sync (gu) {
        gu.chunkBlockDist       = this.chunkBlockDist;

        gu.fogAddColor          = this.rawInterpolatedFogAdd;
        gu.fogColor             = this.rawInterpolatedFog;
        gu.brightness           = this.fullBrightness;

        gu.time                 = this.time;
        //gu.fogDensity           = this.fogDensity * fogPreset.density;
        gu.sunDir               = this.sunDir;
    }

    draw (render : Renderer) {
        if (!this.skyBox) {
            return;
        }

        const { width, height }  = render.renderBackend.size;

        const uniforms = this.skyBox.shader.uniforms;

        for(let i = 0; i < 3; i++) {
            this._skyColor[i] = this.lerpWeatherValue(weather => Weather.SKY_COLOR[weather][i])
        }
        uniforms['u_baseColor'].value = this._skyColor
        uniforms['u_nightshift'].value = this.nightshift;

        this.skyBox.draw(render.viewMatrix, render.projMatrix, width, height);
    }
}