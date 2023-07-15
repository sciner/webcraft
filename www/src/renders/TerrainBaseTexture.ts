import {BaseImageResource, SCALE_MODES, BaseTexture, WRAP_MODES} from 'vauxcel';
import {TerrainTextureUniforms} from "./common.js";

export type GPUScaleMode = 'nearest' | 'linear';

export interface TerrainTextureSourceOptions {
    source: ImageBitmap | HTMLCanvasElement;
    style?: TerrainTextureUniforms;
    minFilter?: GPUScaleMode;
    magFilter?: GPUScaleMode;
    wrapMode?: WRAP_MODES;
}
export class TerrainTextureSource extends BaseImageResource {
    terrainStyle: TerrainTextureUniforms;
    minFilter: GPUScaleMode;
    magFilter?: GPUScaleMode;
    constructor(options: TerrainTextureSourceOptions) {
        super(options.source);
        this.terrainStyle = options.style || new TerrainTextureUniforms();
        this.minFilter = options.minFilter ?? 'nearest';
        this.magFilter = options.magFilter ?? 'nearest';
    }
}

export class TerrainBaseTexture extends BaseTexture<TerrainTextureSource>
{
    declare resource: TerrainTextureSource;
    declare width: number;
    declare height: number;
    constructor(options: TerrainTextureSourceOptions) {
        super(new TerrainTextureSource(options), {
            wrapMode: options.wrapMode || WRAP_MODES.CLAMP,
            mipmap: 0,
            alphaMode: 0,
            format: 'rgba8unorm-srgb',
        });
        this.minFilter = this.resource.minFilter;
    }

    get minFilter() {
        return (this as any).scaleMode === SCALE_MODES.LINEAR ? 'linear' : 'nearest';
    }

    get magFilter() {
        return (this as any).scaleMode === SCALE_MODES.LINEAR ? 'linear' : 'nearest';
    }

    set minFilter(value: GPUScaleMode) {
        (this as any).scaleMode = value === 'linear' ? SCALE_MODES.LINEAR: SCALE_MODES.NEAREST;
    }

    set magFilter(value: GPUScaleMode) {
        (this as any).scaleMode = value === 'linear' ? SCALE_MODES.LINEAR: SCALE_MODES.NEAREST;
    }

    get style() {
        return this.resource.terrainStyle;
    }
}
