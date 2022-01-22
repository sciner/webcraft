import { lerpComplex, Mth } from "./helpers.js";
import { GlobalUniformGroup } from "./renders/BaseRenderer.js";
import { Resources } from "./resources.js";

/**
 * @typedef {object} FogPreset
 * @property {boolean} [computed] compute fog value from env gradient
 * @property {[number,number, number, number ]} color
 * @property {[number,number, number, number ]} addColor
 * @property {number} density
 */

export const PRESET_NAMES = {
    NORMAL: 'normal',
    WATER: 'water',
    LAVA: 'lava'
}

const ENV_GRAD_COLORS = Object.entries({
    [0]: 0x020202,
    [35]: 0x250a07,
    [46]: 0x963b25,
    [55]: 0xe3ad59,
    [65]: 0x76c2ff, // as fog
    [100]: 0x76c2ff, // as fog
})
.map(([key, color]) => ({
        pos: +key / 100,
        value: [
            (color >> 16 & 0xff) / 0xff,
            (color >> 8 & 0xff) / 0xff,
            (color & 0xff) / 0xff
        ]
    })
);

export const FOG_PRESETS = {
    [PRESET_NAMES.NORMAL]: {
        // PLZ, not enable yet
        computed: false, // disable temporary, for computed a color shpuld be ENV_GRAD_COLORS
        color: [118 / 255, 194 / 255, 255 / 255, 1],
        addColor: [0, 0, 0, 0],
        density: 2.52 / 320,
    },

    [PRESET_NAMES.WATER]: {
        computed: false,
        color: [55 / 255, 100 / 255, 230 / 255, 1],
        addColor: [55 / 255, 100 / 255, 230 / 255, 0.45],
        density: 0.1
    },

    [PRESET_NAMES.LAVA]: {
        computed: false,
        color: [255 / 255, 100 / 255, 20 / 255, 1],
        addColor: [255 / 255, 100 / 255, 20 / 255, 0.45],
        density: 0.5
    }
};

export const SETTINGS = {
    skyColor:               [0, 0, 0.8],
    fog:                    'base', //for preset
    fogDensity:             1, // multiplication
    fogDensityUnderWater:   0.1,
    chunkBlockDist:         8,
    interpoateTime:         300,
};

function deepClone(obj, target = {}) {
    return lerpComplex(obj, obj, 0, target);
}

function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
}

function luminance (color) {
    const r = color[0]
    const g = color[1];
    const b = color[2];

    return  Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b );
}

function interpolateColor (a, b, factor = 0, target = []) {
    target[0] = a[0] * (1 - factor) + b[0] * factor;
    target[1] = a[1] * (1 - factor) + b[1] * factor;
    target[2] = a[2] * (1 - factor) + b[2] * factor;

    return target;
}

class InterpolateTask {
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

        this.value = null;
        this.t = 0;
        this.update(0);
    }

    get done() {
        return this.t >= 1;
    }

    update(delta = 0) {
        if (this.t >= 1) {
            return;
        }

        this.t += delta / this.dur;

        const lim = this.ease(Mth.clamp(this.t, 0, 1));

        this.value = Mth.lerpComplex(this.from, this.to, lim, this.value);

        if (this.context) {
            this.context[this.name] = this.value;
        }
    }
}

function interpolateGrad (pattern, factor = 0,target = []) {
    factor = Math.max(0, Math.min(1, factor));

    let rightKey = pattern[0];
    let leftKey = pattern[0];

    for(const entry of pattern) {
        rightKey = entry;

        if (rightKey.pos >= factor) {
            break;
        }

        leftKey = entry;
    }

    const relative = (factor - leftKey.pos) / (rightKey.pos - leftKey.pos);

    return interpolateColor(leftKey.value, rightKey.value, relative, target);
}

export class Environment {
    constructor() {
        this.actualFog = [0,0,0,0];
        this.actualFogAdd = [0,0,0,0];

        this.skyColor = [...SETTINGS.skyColor];
        this.fogDensity = SETTINGS.fogDensity;
        this.chunkBlockDist = SETTINGS.chunkBlockDist;
        this.sunDir = [0.9593, 1.0293, 0.6293];
        this.brightness = 1.;
        this.nightshift = 1.;

        this.skyBox = null;

        this._currentPresetName = PRESET_NAMES.NORMAL;
        this._fogInterpolationTime = 0;

        /***
         * @type {FogPreset}
         */
        this._interpolatedPreset = deepClone(FOG_PRESETS[PRESET_NAMES.NORMAL]);

        // fog color before apply brightness factor
        this._computedFogRaw = [0,0,0,0];

        this._computedBrightness = 1;

        this._fogDirty = false;

        this._tasks = new Map();
        this._interpolate(0);
    }

    get fullBrightness() {
        return this.brightness * this.nightshift * this._computedBrightness;
    }

    /**
     * @returns {FogPreset}
     */
    get fogPresetRes() {
        return this._interpolatedPreset;
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
        if (!(v in FOG_PRESETS)) {
            v = FOG_PRESETS.NORMAL;
        }

        if (v === this._currentPresetName) {
            return;
        }

        const from = this._currentPresetName;

        this._currentPresetName = v;
        this._fogDirty = true;

        this._runInterpolation('_interpolatedPreset', FOG_PRESETS[from], FOG_PRESETS[v]);
    }

    get time() {
        return performance.now();
    }

    /**
    * State relative color interpolated with brightness, time and underwater knowledge
    */
    get actualFogColor() {
        return this.actualFog;
    }

    /**
     *
     * @param {Renderer} render
     */
    init (render) {
        const  {
            renderBackend
        }  = render;

        this.skyBox = renderBackend.createCubeMap({
            code: Resources.codeSky,
            uniforms: {
                u_brightness: 1.0,
                u_textureOn: true
            },
            sides: [
                Resources.sky.posx,
                Resources.sky.negx,
                Resources.sky.posy,
                Resources.sky.negy,
                Resources.sky.posz,
                Resources.sky.negz
            ]
        });
    }

    setBrightness(value) {
        if (value === this.brightness) {
            return;
        }

        this.brightness = value;
        this._fogDirty = true;
    }

    /**
     * @todo Atm we can't use computed sun and state interpolation
     * Fix this case
     */
    _computeFogRelativeSun() {
        return;
        this.sunDir = [
            0, Math.cos(this.time / 10000), -Math.sin(this.time / 10000)
        ];

        const sun = this.sunDir;
        const len = Math.sqrt(sun[0] * sun[0] + sun[1] * sun[1] + sun[2] * sun[2]);
        const dir = [sun[0] / len, sun[1] / len, sun[2] / len];

        // up vector only is Y
        const factor = 0.5 * (1. + dir[1]);
        const color = interpolateGrad(ENV_GRAD_COLORS, factor, this._computedFogRaw);

        const lum = luminance(color) / luminance(ENV_GRAD_COLORS[ENV_GRAD_COLORS.length - 1].value);

        this._computedBrightness = lum * lum;
        this._fogDirty = true;
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

        const task = new InterpolateTask({
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
            t.update(delta / 60);

            if (t.done) {
                this._taskDone(t);
            }
            this._fogDirty = true;
        }
    }

    updateFogState() {
        if (!this._fogDirty) {
            return;
        }

        const p = this._interpolatedPreset;

        let fogColor = p.color;
        let fogAdd = p.addColor;

        /*
        // not supported yet because we use interpolated state.
        // We should interpolate and color and states, but, need resolve wich state will have computed fog

        if (p.computed) {
            // compute color
            this._computeFogRelativeSun();

            // our fog color is computed, use it
            fogColor = this._computedFogRaw;
        }*/

        const value = this.brightness * this._computedBrightness;
        const mult = Math.min(1, value * 2) * this.nightshift * value;

        for (let i = 0; i < 3; i ++) {
            this.actualFog[i] = fogColor[i] * mult;
            this.actualFogAdd[i] = fogAdd[i];
        }

        this.actualFog[3] = 1;
        this.actualFogAdd[3] = fogAdd[3];

        this._fogDirty = false;
    }

    setEnvState ({
        fogDensity = this.fogDensity,
        chunkBlockDist = this.chunkBlockDist,
        nightshift = this.nightshift,
        preset = this._currentPresetName,
        brightness = this.brightness
    }) {
        if (this.nightshift !== nightshift) {
            this._fogDirty = true;
        }
        this.nightshift = nightshift;

        if (this.fogDensity !== this.fogDensity) {
            this._fogDirty = true;
        }
        this.fogDensity = fogDensity;

        if (!isFinite(chunkBlockDist)) {
            chunkBlockDist = 10000 * Math.sign(chunkBlockDist);
        }

        if (this.chunkBlockDist !== chunkBlockDist) {
            this._fogDirty = true;
            this._runInterpolation('chunkBlockDist', this.chunkBlockDist, chunkBlockDist);
        }
        this.chunkBlockDist = chunkBlockDist;

        this.setBrightness(brightness);

        this.fogPreset = preset;
    }

    update (delta, args) {
        this._interpolate(delta);
        this.updateFogState();
    }

    /**
     * Sync environment state with uniforms
     * @param {GlobalUniformGroup} render
     */
    sync (gu) {
        const fogPreset = this.fogPresetRes;

        gu.chunkBlockDist       = this.chunkBlockDist;

        gu.fogAddColor          = this.actualFogAdd;
        gu.fogColor             = this.actualFog;
        gu.brightness           = this.fullBrightness;

        gu.time                 = this.time;
        gu.fogDensity           = this.fogDensity * fogPreset.density;
        gu.testLightOn          = this.testLightOn;
        gu.sunDir               = this.sunDir;
    }

    /**
     *
     * @param {Renderer} render
     */
    draw (render) {
        if (!this.skyBox) {
            return;
        }

        const { width, height }  = render.renderBackend.size;

        // other will updated from GU
        if (this.skyBox.shader.uniforms) {
            this.skyBox.shader.uniforms.u_textureOn.value = this.brightness >= 0.9 && this._currentPresetName === PRESET_NAMES.NORMAL;
        }

        this.skyBox.draw(render.viewMatrix, render.projMatrix, width, height);
    }
}