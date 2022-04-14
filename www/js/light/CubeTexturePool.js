import {Vector} from '../helpers.js';
import {BaseTexture3D} from "../renders/BaseTexture3D.js";

export class GridCubeTexture {
    constructor({ textureOptions, dims }) {
        this.textureOptions = textureOptions;
        this.dims = dims;
        this.freeRegions = []
        this.allocatedRegions = []
    }

    init() {
        const { dims, textureOptions } = this;

        this.baseTexture = new BaseTexture3D(textureOptions);

        for (let i = 0; i < dims.x; i++)
            for (let j = 0; j < dims.y; j++)
                for (let k = 0; k < dims.z; k++) {

                }
    }

    allocate() {
    }
}

export class CubeTexturePool {
    constructor({
        defWidth = 16,
        defHeight = 16,
        defDepth = 40,
        bigWidth = 128,
        bigHeight = 128,
        bigDepth = 128,
        type = 'rgba8unorm',
        filter = 'linear',
        renderer
    }) {
        this.bigWidth = bigWidth;
        this.bigHeight = bigHeight;
        this.bigDepth = bigDepth;
        this.defTex = {
            width: defWidth,
            height: defHeight,
            depth: defDepth,
            filter, type,
            context: renderer
        }
        this.singles = []
        this.pools = []
        this.renderer = renderer
        this.currentPoolIndex = 0
    }

    alloc({width, height, depth, type, filter, data}) {
        const { defTex } = this;
        // if (width !== this.defTex.width || height !== this.defTex.height || depth !== this.defTex.depth) {
            // create a single
            const tex = this.renderer.createTexture3D(
                {width, height, depth, type, filter, data})
            tex.ownerPool = this;
            this.singles.push(tex);
            return tex;
        // } else {
            // 1. choose pool

        // }
    }

    findFreeRegion() {
        let cur = this.currentPoolIndex;
        let repeat = 0;
        let selected = null;
        while (repeat < this.pools.length) {
            if (this.pools[cur].freeRegions.length > 0) {
                selected = this.pools[cur];
                break;
            }
            cur = (cur + 1) % this.pools.length
            repeat++
        }
        if (!selected) {
            let newCube = new GridCubeTexture(
                {
                    textureOptions: this.defTex,
                    dims: new Vector(
                        Math.floor(this.bigWidth / this.defWidth),
                        Math.floor(this.bigHeight / this.defHeight),
                        Math.floor(this.bigDepth / this.defDepth),
                    )
                }
            )
        }
    }

    dealloc(tex) {
        // if (tex.isRegion) {
            const ind = this.singles.indexOf(tex);
            if (ind >= 0) {
                this.singles.splice(ind, 1);
                tex.destroy();
            }
        // } else {
        //
        // }
    }

    destroy() {
        for (let i=0;i<this.singles.length;i++) {
            this.singles[i].destroy();
        }
    }
}