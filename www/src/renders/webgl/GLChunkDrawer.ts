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
        this.offsetsInt = new Int32Array(this.offsets.buffer);
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
        let {elements, context, offsets, offsetsInt, counts} = this;
        let sz = 0;
        let baseGeom = elements[0].baseGeometry;
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

        const mdb = context.multidrawBaseExt, md = context.multidrawExt, gl = context.gl;
        const {arrZeros, arrSixes} = this;

        if (baseGeom.hasInstance) {
            if (mdb) {
                mdb.multiDrawArraysInstancedBaseInstanceWEBGL(
                    gl.TRIANGLES,
                    arrZeros, 0,
                    arrSixes, 0,
                    counts, 0,
                    offsets, 0,
                    sz,
                );
                context.stat.multidrawcalls++;
            } else {
                // manual vertexAttribPointer
            }
        } else {
            // multi draw arrays
            if (baseGeom.indexBuffer) {
                for (let j = 0; j < sz; j++) {
                    offsets[j] *= baseGeom.indexPerInstance * 4;
                    counts[j] *= baseGeom.indexPerInstance;
                }
            } else {
                for (let j = 0; j < sz; j++) {
                    offsets[j] *= baseGeom.vertexPerInstance;
                    counts[j] *= baseGeom.vertexPerInstance;
                }
            }

            if (md) {
                if (baseGeom.indexBuffer) {
                    md.multiDrawElementsWEBGL(
                        gl.TRIANGLES,
                        counts, 0,
                        gl.UNSIGNED_INT,
                        offsetsInt, 0,
                        sz,
                    );
                } else {
                    md.multiDrawArraysWEBGL(
                        gl.TRIANGLES,
                        offsetsInt, 0,
                        counts, 0,
                        sz,
                    );
                }
                context.stat.multidrawcalls++;
            } else {
                if (baseGeom.indexBuffer) {
                    for (let i = 0; i < sz; i++) {
                        gl.drawElements(gl.TRIANGLES, counts[i], gl.UNSIGNED_INT, offsets[i]);
                        context.stat.drawcalls++;
                    }
                } else {
                    for (let i = 0; i < sz; i++) {
                        gl.drawArrays(gl.TRIANGLES, offsets[i], counts[i]);
                        context.stat.drawcalls++;
                    }
                }
            }
        }
    }
}
