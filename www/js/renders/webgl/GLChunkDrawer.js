import {ChunkDrawer} from "../batch/ChunkDrawer.js";

export class GLChunkDrawer extends ChunkDrawer {
    constructor(context) {
        super(context);

        this.arrZeros = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.arrSixes = [6, 6, 6, 6, 6, 6, 6, 6, 6, 6];
        this.curMat = null;
        this.curBase = null;
        this.elements = [];
        this.count = 0;
        this.offsets = [];
        this.counts = [];
    }

    start() {
        this.currentMat = null;
    }

    draw(geom, material, chunk) {
        const { context } = this;
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
            // material.shader.updatePos(chunk.coord, null);
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
        const {elements, context, offsets, counts} = this;
        let sz = 0;
        for (let i = 0; i < this.count; i ++) {
            const geom = elements[i];
            elements[i] = null;

            for (let j=0;j<geom.glOffsets.length;j++) {
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
        while (arrZeros.length < sz) {
            arrZeros.push(0);
            arrSixes.push(6);
        }
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
