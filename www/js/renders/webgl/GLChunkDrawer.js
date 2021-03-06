import {ChunkDrawer} from "../batch/ChunkDrawer.js";

export class GLChunkDrawer extends ChunkDrawer {
    constructor(context) {
        super(context);

        this.resize(32);
        this.curMat = null;
        this.curBase = null;
        this.elements = [];
        this.count = 0;
    }

    resize(sz) {
        this.size = sz;
        const oldCnt = this.counts, oldOff = this.offsets;
        this.arrZeros = new Int32Array(sz);
        this.arrSixes = new Int32Array(sz);
        this.counts = new Int32Array(sz);
        this.offsets = new Uint32Array(sz);
        for (let i = 0; i < sz; i++) {
            this.arrSixes[i] = 6;
        }
        if (oldCnt) {
            this.counts.set(oldCnt, 0);
            this.offsets.set(oldOff, 0);
        }
    }

    draw(geom, material, chunk) {
        const {context} = this;
        if (geom.size === 0 || geom.glCounts && geom.glCounts.length === 0) {
            return;
        }
        let gl = context.gl;

        if (geom.baseGeometry) {
            if (this.curBase !== geom.baseGeometry
                || this.curMat !== material) {
                this.flush();
                this.curBase = geom.baseGeometry;
                this.curMat = material;
                material.bind();
                this.curBase.bind(material.shader);
                material.shader.updatePos(chunk.coord, null);
            }
            this.elements[this.count++] = geom;
        } else {
            this.flush();
            material.bind();
            geom.bind(material.shader);
            //TODO: find why some chunks are using chunkID = -1, remove this line
            material.shader.updatePos(chunk.coord, null);
            gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, geom.size);
            // stat
            context.stat.drawquads += geom.size;
            context.stat.drawcalls++;
        }
    }

    flush() {
        if (this.count === 0) {
            return;
        }
        let {elements, context, offsets, counts} = this;
        let sz = 0;
        for (let i = 0; i < this.count; i++) {
            const geom = elements[i];
            elements[i] = null;

            const len = geom.glOffsets.length;
            if (this.size < sz + len) {
                this.resize((sz + len) * 2);
                offsets = this.offsets;
                counts = this.counts;
            }
            for (let j = 0; j < len; j++) {
                offsets[sz] = geom.glOffsets[j];
                counts[sz] = geom.glCounts[j];
                sz++;
            }
            context.stat.drawquads += geom.sizeQuads;
        }

        this.count = 0;
        this.curBase = null;
        this.curMat = null;

        const md = context.multidrawExt, gl = context.gl;
        const {arrZeros, arrSixes} = this;
        md.multiDrawArraysInstancedBaseInstanceWEBGL(
            gl.TRIANGLES,
            arrZeros, 0,
            arrSixes, 0,
            counts, 0,
            offsets, 0,
            sz,
        );
        context.stat.multidrawcalls++;
    }
}
