export class BigCubeTexture {
    constructor() {
    }

    allocate() {
    }
}

export class CubeTexturePool {
    constructor({
        defWidth = 16,
        defHeight = 16,
        defDepth = 40,
        renderer
    }) {
        this.defWidth = defWidth;
        this.defHeight = defHeight;
        this.defDepth = defDepth;
        this.singles = []
        this.pools = []
        this.renderer = renderer
    }

    alloc({width, height, depth, type, filter, data}) {
        // if (width !== this.width || height !== this.defHeight || depth !== this.defDepth) {
            // create a single
        const tex = this.renderer.createTexture3D(
            {width, height, depth, type, filter, data})
        tex.ownerPool = this;
        this.singles.push(tex);
        return tex;
        // }
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