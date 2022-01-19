import { Resources } from "./resources.js";

const SETTINGS = {
    skyColor:               [0, 0, 0.8],
    fogColor:               [118 / 255, 194 / 255, 255 / 255, 1], // [185 / 255, 210 / 255, 255 / 255, 1],
    // fogColor:               [192 / 255, 216 / 255, 255 / 255, 1],
    fogUnderWaterColor:     [55 / 255, 100 / 255, 230 / 255, 1],
    fogAddColor:            [0, 0, 0, 0],
    fogUnderWaterAddColor:  [55 / 255, 100 / 255, 230 / 255, 0.45],
    fogDensity:             2.52 / 320,
    fogDensityUnderWater:   0.1,
    chunkBlockDist:         8,
};

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
        this.fogColor = [...SETTINGS.fogColor];
        this.fogColorBrigtness = [...this.fogColor];
        this.fogAddColor = [...SETTINGS.fogAddColor];
        this.skyColor = [...SETTINGS.skyColor];
        this.fogDensity = SETTINGS.fogDensity;
        this.chunkBlockDist = SETTINGS.chunkBlockDist;
        this.sunDir = [0.9593, 1.0293, 0.6293];

        this.underwater = false;
        this.brightness = 1.;

        this.skyBox = null;
    }

    get time() {
        return performance.now();
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
        const mult = Math.min(1, value * 2)

        this.brightness = value;
        this.fogColorBrigtness = [
            this.fogColor[0] * (value * mult),
            this.fogColor[1] * (value * mult),
            this.fogColor[2] * (value * mult),
            this.fogColor[3]
        ];
    }

    computeFogRelativeSun() {
        this.sunDir = [
            0, Math.cos(this.time / 10000), -Math.sin(this.time / 10000)
        ];

        const sun = this.sunDir;
        const len = Math.sqrt(sun[0] * sun[0] + sun[1] * sun[1] + sun[2] * sun[2]);
        const dir = [sun[0] / len, sun[1] / len, sun[2] / len];

        // up vector only is Y
        const factor = 0.5 * (1. + dir[1]);
        const color = interpolateGrad(ENV_GRAD_COLORS, factor, this.fogColor);

        this.fogColor[3] = 1;

        const lum = luminance(color) / luminance(ENV_GRAD_COLORS[ENV_GRAD_COLORS.length - 1].value);

        this.fogColorBrigtness = this.fogColor;
        this.brightness = lum * lum;
    }

    setEnvState ({
        underwater = this.underwater,
        fogDensity = this.fogColor,
        fogColor = this.fogColor,
        fogAddColor = this.fogAddColor,
        chunkBlockDist = this.chunkBlockDist,
    }) {
        this.underwater = underwater;
        this.fogDensity = fogDensity;
        this.fogColor = [...fogColor];
        this.fogAddColor = [...fogAddColor];
        this.chunkBlockDist = chunkBlockDist;

        this.setBrightness(this.brightness);
    }

    /**
     * Sync environment state with uniforms
     * @param {Renderer} render 
     */
    sync (render) {
        const gu                 = render.globalUniforms;
        const { width, height }  = render.renderBackend;

        gu.chunkBlockDist       = this.chunkBlockDist;

        gu.fogAddColor          = this.underwater ? SETTINGS.fogUnderWaterAddColor : this.fogAddColor;
        gu.fogColor             = this.underwater ? SETTINGS.fogUnderWaterColor : this.fogColorBrigtness;
        gu.brightness           = this.brightness;
        //
        gu.time                 = this.time;
        gu.fogDensity           = this.fogDensity;
        gu.resolution           = [width, height];
        gu.testLightOn          = this.testLightOn;
        gu.sunDir               = this.sunDir;
        
        gu.update();
    }

    /**
     * 
     * @param {Renderer} render 
     */
    draw (render) {
        if (!this.skyBox) {
            return;
        }
 
        const { width, height }  = render.renderBackend;

        this.skyBox.draw(render.viewMatrix, render.projMatrix, width, height);
    }
}