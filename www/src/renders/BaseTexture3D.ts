import {Vector} from '../helpers.js';
import { BaseRenderer } from "./BaseRenderer.js";

export class BaseTexture3D {
    width: number;
    height: number;
    depth: number;
    offset = new Vector(0, 0, 0);
    minFilter: string;
    magFilter: string;
    wrap: string;
    type: string;
    data: Uint8Array | Uint16Array | Int32Array;
    context: BaseRenderer;
    id = BaseRenderer.ID++;
    dirty = true;
    prevLength = 0;

    innerWidth: number;
    innerHeight: number;
    innerDepth: number;

    regionsToUpdate: Array<RegionTexture3D> = [];
    useSubRegions = false;
    ownerPool = null;
    isRegion = false;
    isEmpty = false;
    fixedSize: boolean;
    emptyRegion: RegionTexture3D = null;
    pixelSize: number;

    /**
     * permanent location for base light texture in pool
     */
    _poolLocation = -1;

    constructor(context, {
        width = 1,
        height = 1,
        depth = 1,
        type = 'u8',
        filter = 'nearest',
        wrap = 'clamp',
        data = null,
        fixedSize = true,
        pixelSize = 1,
    } = {}) {
        this.width = width;
        this.height = height;
        this.depth = depth;

        this.innerWidth = width / pixelSize;
        this.innerHeight = height / pixelSize;
        this.innerDepth = depth / pixelSize;
        if (!data) {
            this.innerWidth += this.innerWidth % 2;
            this.innerHeight += this.innerHeight % 2;
            this.innerDepth += this.innerDepth % 2;
        }

        this.minFilter = filter;
        this.magFilter = filter;
        this.wrap = wrap;
        this.type = type;
        this.data = data;
        this.pixelSize = pixelSize;

        this.context = context;
        this.id = BaseRenderer.ID++;
        this.dirty = true;
        this.prevLength = 0;
        this.fixedSize = fixedSize;
    }

    upload() {
        this.context._textures[this.id] = this;
        this.dirty = false;
    }

    destroy() {
        delete this.context._textures[this.id];
    }

    update(data) {
        this.dirty = true;
        if (data) {
            this.data = data;
        }
    }

    bind(location?: number) {
    }

    isSimilar() {
        return false;
    }
}

export class RegionTexture3D {
    baseTexture: BaseTexture3D;
    width: number;
    height: number;
    depth: number;
    offset: Vector;
    type: string;
    data: Uint8Array | Uint16Array | Int32Array;
    allocated = false;

    context: BaseRenderer;
    id = BaseRenderer.ID++;
    dirty: boolean;
    ownerPool: any = null;
    isRegion = true;
    isEmpty = false;

    constructor(context, {
        baseTexture = null,
        width = 0,
        height = 0,
        depth = 0,
        offset = new Vector(0, 0, 0),
        type = null,
        data = null,
    } = {}) {
        this.baseTexture = baseTexture;
        this.width = width || baseTexture.width;
        this.height = height || baseTexture.height;
        this.depth = depth || baseTexture.depth;
        this.offset = offset;
        this.type = type;
        this.data = data;
        this.allocated = false;

        this.context = context;
        this.dirty = data !== null;
    }

    dispose() {
        this.allocated = false;
        this.dirty = false;
        this.data = null;
    }

    update(data) {
        if (!this.baseTexture.useSubRegions) {
            this.baseTexture.update(data);
            return;
        }

        this.allocated = true;
        if (!this.dirty) {
            this.dirty = true;
            this.baseTexture.dirty = true;
            this.baseTexture.regionsToUpdate.push(this);
        }
        this.data = data;
    }
}