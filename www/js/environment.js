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
    }
};

export const SETTINGS = {
    skyColor:               [0, 0, 0.8],
    fog:                    'base', //for preset
    fogDensity:             1, // multiplication
    fogDensityUnderWater:   0.1,
    chunkBlockDist:         8,
};

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
        this.computedFog = [0,0,0,0];
        this.skyColor = [...SETTINGS.skyColor];
        this.fogDensity = SETTINGS.fogDensity;
        this.chunkBlockDist = SETTINGS.chunkBlockDist;
        this.sunDir = [0.9593, 1.0293, 0.6293];
        this.brightness = 1.;
        this.nightshift = 1.;

        this.skyBox = null;

        this._fogPresetName = PRESET_NAMES.NORMAL;
    }

    get fullBrightness() {
        return this.brightness * this.nightshift
    }

    /**
     * @returns {FogPreset}
     */
    get fogPresetRes() {
        return FOG_PRESETS[this._fogPresetName];
    }

    /**
     * Set fog preset state
     */
    set fogPreset(v) {
        if (v === this._fogPresetName) {
            return;
        }

        if (v in FOG_PRESETS) {
            this._fogPresetName = v;
        }

        this._fogPresetName = v;

        this.updateFogState();
    }

    /**
     * Return actual used fog
     */
    get fogPreset() {
        return this._fogPresetName;
    }

    get time() {
        return performance.now();
    }

    /**
    * State relative color interpolated with brightness, time and underwater knowledge
    */
    get actualFogColor() {
        return this.computedFog;
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
        this.brightness = value;

        this.updateFogState();
    }

    _computeFogRelativeSun() {
        this.sunDir = [
            0, Math.cos(this.time / 10000), -Math.sin(this.time / 10000)
        ];

        const sun = this.sunDir;
        const len = Math.sqrt(sun[0] * sun[0] + sun[1] * sun[1] + sun[2] * sun[2]);
        const dir = [sun[0] / len, sun[1] / len, sun[2] / len];

        // up vector only is Y
        const factor = 0.5 * (1. + dir[1]);
        const color = interpolateGrad(ENV_GRAD_COLORS, factor, this.fogColor);


        const lum = luminance(color) / luminance(ENV_GRAD_COLORS[ENV_GRAD_COLORS.length - 1].value);
        
        this.fogColor[0] *= this.nightshift;
        this.fogColor[1] *= this.nightshift;
        this.fogColor[2] *= this.nightshift;        
        this.fogColor[3] = 1;

        this.fogColorBrigtness = this.fogColor;
        this.brightness = lum * lum;
    }

    updateFogState() {
        const p = this.fogPresetRes;

        if (p.computed) {
            this._computeFogRelativeSun();
            return;
        }

        const value = this.brightness;
        const mult = Math.min(1, value * 2) * this.nightshift;

        this.computedFog[0] = p.color[0] * (value * mult);
        this.computedFog[1] = p.color[1] * (value * mult);
        this.computedFog[2] = p.color[2] * (value * mult);
        this.computedFog[3] = p.color[3];
    
    }

    setEnvState ({
        fogDensity = this.fogDensity,
        chunkBlockDist = this.chunkBlockDist,
        nightshift = this.nightshift,
        preset = this._fogPresetName,
        brightness = this.brightness
    }) {
        this.nightshift = nightshift;
        this.fogDensity = fogDensity;
        this.chunkBlockDist = chunkBlockDist;
        this.brightness = brightness;

        this._fogPresetName = preset;

        this.updateFogState();
    }

    /**
     * Sync environment state with uniforms
     * @param {GlobalUniformGroup} render 
     */
    sync (gu) {
        const fogPreset = this.fogPresetRes;

        gu.chunkBlockDist       = this.chunkBlockDist;

        gu.fogAddColor          = fogPreset.addColor;
        gu.fogColor             = this.computedFog;
        gu.brightness           = this.brightness * this.nightshift;

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
            this.skyBox.shader.uniforms.u_textureOn.value = this.brightness >= 0.9 && this._fogPresetName === PRESET_NAMES.NORMAL;
        }

        this.skyBox.draw(render.viewMatrix, render.projMatrix, width, height);
    }
}