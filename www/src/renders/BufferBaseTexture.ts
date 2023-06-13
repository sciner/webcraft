import {
    BufferResource,
    BufferType,
    TEXTURE_FORMATS,
    SCALE_MODES,
    Buffer3DResource, Texture3D,
    BaseTexture
} from 'vauxcel';
import type {GPUScaleMode} from "./TerrainBaseTexture.js";

export interface BufferBaseTextureOptions {
    width: number;
    height: number;
    data?: BufferType;
    minFilter?: GPUScaleMode;
    magFilter?: GPUScaleMode;
    format?: TEXTURE_FORMATS;
}
export class BufferBaseTexture extends BaseTexture<BufferResource>
{
    declare resource: BufferResource;
    declare width: number;
    declare height: number;
    constructor(options: BufferBaseTextureOptions) {

        let format = options.format || detectBufferTextureFormat(options.data);

        super(new BufferResource(options.data, options), { format });
        (this as any).scaleMode = options.minFilter === 'linear' ? SCALE_MODES.LINEAR : SCALE_MODES.NEAREST;
        (this as any).mipmap = 0;
        (this as any).alphaMode = 0;
    }

    update() {
        super.update();
    }
}

export interface IBuffer3DResourceOptionsWithData {
    width: number;
    height: number;
    depth: number;
    pixelSize?: number;
    data?: BufferType;
    //TODO: move to vauxcel
    format?: TEXTURE_FORMATS;
    minFilter?: GPUScaleMode;
    magFilter?: GPUScaleMode;
    useSubRegions?: boolean;
}
export class BufferBaseTexture3D extends BaseTexture<Buffer3DResource>
{
    declare resource: Buffer3DResource;
    declare width: number;
    declare height: number;
    declare depth: number;

    hasEmpty = false;
    emptyRegion: Texture3D = null;
    ownerPool: any = null;
    _poolLocation: number = -1;
    constructor(options: IBuffer3DResourceOptionsWithData) {
        let format = options.format || detectBufferTextureFormat(options.data);

        super(new Buffer3DResource(options.data, {...options, useFixedSize: true}), { format });
        (this as any).scaleMode = options.minFilter === 'linear' ? SCALE_MODES.LINEAR : SCALE_MODES.NEAREST;
        (this as any).mipmap = 0;
        (this as any).alphaMode = 0;
    }

    update() {
        super.update();
    }
}

export function detectBufferTextureFormat(buffer: BufferType): TEXTURE_FORMATS {
    let format : TEXTURE_FORMATS;
    if (buffer instanceof Float32Array)
    {
        format = 'rgba8unorm';
    }
    else if (buffer instanceof Int32Array)
    {
        format = 'rgba32sint';
    }
    else if (buffer instanceof Uint32Array)
    {
        format = 'rgba32uint';
    }
    else if (buffer instanceof Int16Array)
    {
        format = 'rgba16sint';
    }
    else if (buffer instanceof Uint16Array)
    {
        format = 'rgba16uint';
    }
    else if (buffer instanceof Int8Array)
    {
        format = 'rgba8sint';
    }
    else
    {
        format = 'rgba8unorm';
    }

    return format;
}
