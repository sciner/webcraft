import {Vector} from '../helpers.js';
import {BaseTexture3D, RegionTexture3D} from "../renders/BaseTexture3D.js";

export class GridCubeTexture {
    [key: string]: any;
    constructor({textureOptions, dims, context}) {
        this.textureOptions = textureOptions;
        this.dims = dims;
        this.freeRegions = []
        this.allocatedRegions = []
        this.context = context;
        this.baseTexture = null;
    }

    init() {
        const {dims, context} = this;
        const to = this.textureOptions;
        const baseTexture = this.baseTexture = this.context.createTexture3D({
            width: dims.x * to.width,
            height: dims.y * to.height,
            depth: dims.z * to.depth,
            pixelSize: to.pixelSize,
            filter: to.filter,
            type: to.type
        });
        baseTexture.useSubRegions = true;
        const hasEmpty = baseTexture.hasEmpty = dims.x + dims.y + dims.z > 3;

        for (let i = 0; i < dims.x; i++)
            for (let j = 0; j < dims.y; j++)
                for (let k = 0; k < dims.z; k++) {

                    const tex = new RegionTexture3D(context, {
                        baseTexture,
                        ...to,
                        offset: new Vector(i * to.width, j * to.height, k * to.depth),
                        data: null
                    })
                    if (i + j + k === 0 && hasEmpty) {
                        baseTexture.emptyRegion = tex;
                        continue;
                    }
                    this.freeRegions.push(tex);
                }
    }
}

export class CubeTexturePool {
    [key: string]: any;
    constructor(context, {
        defWidth = 18,
        defHeight = 18,
        defDepth = 42,
        bigWidth = 128,
        bigHeight = 256,
        bigDepth = 256,
        type = 'rgba8unorm',
        filter = 'linear',
        maxBoundTextures = 3,
        pixelSize,
    }) {
        if (pixelSize) {
            bigWidth *= pixelSize;
            bigHeight *= pixelSize;
            bigDepth *= pixelSize;
        }
        this.bigWidth = bigWidth;
        this.bigHeight = bigHeight;
        this.bigDepth = bigDepth;
        this.defTex = {
            width: defWidth,
            height: defHeight,
            depth: defDepth,
            filter, type,
            pixelSize
        }
        this.context = context;
        this.singles = []
        this.fromPool = []
        this.pools = []
        this.currentPoolIndex = 0

        this.totalBytes = 0;
        this.totalRegions = 0;
        this.maxBoundTextures = maxBoundTextures;
        this.boundTextures = [null];
        this.bytePerElement = (type === 'rgb565unorm' || type === 'rgba4unorm' || type === 'rgba32sint' ? 2 : 4 );
    }

    alloc({width, height, depth, type, filter, data}) {
        const {defTex} = this;
        if (width !== this.defTex.width || height !== this.defTex.height || depth !== this.defTex.depth) {
            // create a single
            const tex = this.context.createTexture3D(
                {width, height, depth, type, filter, data})
            tex.ownerPool = this;
            this.singles.push(tex);
            this.totalRegions++;
            return tex;
        } else {
            const tex = this.findFreeRegion();
            if (!tex) {
                return null;
            }
            tex.ownerPool = this;
            if (data) {
                tex.update(data);
            }
            this.fromPool.push(tex);
            this.totalRegions++;
            return tex;
        }
    }

    registerLocation(baseTex) {
        const {boundTextures} = this;
        baseTex._ownerPool = this;
        for (let i = 1; i < boundTextures.length; i++) {
            if (!boundTextures[i]) {
                boundTextures[i] = baseTex;
                baseTex._poolLocation = i;
            }
        }
        if (boundTextures.length >= this.maxBoundTextures) {
            return;
        }
        //TODO: check for max size!
        baseTex._poolLocation = boundTextures.length;
        boundTextures.push(baseTex);
    }

    findFreeRegion() {
        const {defTex, pools, context} = this;

        let cur = this.currentPoolIndex;
        let repeat = 0;
        let selected = null;
        while (repeat < pools.length) {
            if (pools[cur].freeRegions.length > 0) {
                selected = pools[cur];
                break;
            }
            cur = (cur + 1) % pools.length
            repeat++
        }
        if (!selected) {
            let newCube = new GridCubeTexture(
                {
                    context,
                    textureOptions: this.defTex,
                    dims: new Vector(
                        Math.floor(this.bigWidth / defTex.width),
                        Math.floor(this.bigHeight / defTex.height),
                        Math.floor(this.bigDepth / defTex.depth),
                    )
                }
            )
            newCube.init();
            const base = newCube.baseTexture;
            this.totalBytes += base.width * base.height * base.depth * this.bytePerElement;
            cur = pools.length;
            pools.push(newCube);
            this.registerLocation(base);
        }
        this.currentPoolIndex = cur;
        const tex = pools[cur].freeRegions.pop();
        pools[cur].allocatedRegions.push(tex);
        return tex;
    }

    dealloc(tex) {
        const {pools, singles} = this;
        if (tex.ownerPool !== this) {
            // wtf
            return;
        }
        if (tex.isRegion) {
            // regions
            let found = null;
            for (let i = 0; i < pools.length; i++) {
                if (pools[i].baseTexture === tex.baseTexture) {
                    found = this.pools[i];
                }
            }
            if (!found) {
                // wtf 2
                return;
            }
            const ind1 = found.allocatedRegions.indexOf(tex);
            if (ind1 >= 0) {
                found.allocatedRegions.splice(ind1, 1);
            } else {
                // wtf 3
                return;
            }
            found.freeRegions.push(tex);
            this.totalRegions--;
            tex.dispose();
        } else {
            // singles
            const ind = singles.indexOf(tex);
            if (ind >= 0) {
                singles.splice(ind, 1);
                this.totalRegions--;
                tex.destroy();
            }
        }
    }

    destroy() {
        for (let i = 0; i < this.singles.length; i++) {
            this.singles[i].destroy();
        }
    }
}