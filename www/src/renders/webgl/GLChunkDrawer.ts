import {ChunkDrawer} from "../batch/ChunkDrawer.js";

export class GLChunkDrawer extends ChunkDrawer {
    [key: string]: any;
    constructor(context) {
        super(context);

        this.resize(32);
        this.curMat = null;
        this.curVao = null;
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

        const baseGeom = geom.baseGeometry;
        if (baseGeom) {
            const vao = geom.batchStatus > 0 ? baseGeom.dynamicDraw : baseGeom.staticDraw;
            if (this.curVao !== vao
                || this.curMat !== material) {
                this.flush();
                this.curVao = vao;
                this.curMat = material;
                material.shader.updatePos(null, null);
                material.bind();
                this.curVao.bind(material.shader);
            }
            this.elements[this.count++] = geom;
        } else {
            this.flush();
            material.shader.updatePos(chunk.coord, null);
            material.bind();
            geom.bind(material.shader);
            //TODO: find why some chunks are using chunkID = -1, remove this line
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
        let curVao = this.curVao;
        for (let i = 0; i < this.count; i++) {
            const geom = elements[i];
            elements[i] = null;

            const len = geom.glOffsets.length;
            if (this.size < sz + len) {
                this.resize((sz + len) * 2);
                offsets = this.offsets;
                counts = this.counts;
            }
            if (geom.batchStatus > 0) {
                offsets[sz] = geom.batchStart;
                counts[sz] = geom.sizeQuads;
                if ((offsets[sz] + counts[sz]) * curVao.stride > curVao.buffer.glLength) {
                    console.log("glOffsets problem");
                }
                sz++;
            } else {
                for (let j = 0; j < len; j++) {
                    offsets[sz] = geom.glOffsets[j];
                    counts[sz] = geom.glCounts[j];
                    if ((offsets[sz] + counts[sz]) * curVao.stride > curVao.buffer.glLength) {
                        console.log("glOffsets problem");
                    }
                    sz++;
                }
            }
            context.stat.drawquads += geom.sizeQuads;
        }

        this.count = 0;
        this.curVao = null;
        this.curMat = null;

        const mdb = context.multidrawBaseExt, md = context.multidrawExt, gl = context.gl;
        const {arrZeros, arrSixes} = this;

        if (curVao.hasInstance) {
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
                //Instance fetch requires 2910, but attribs only supply 0.
                for (let i = 0; i < sz; i++) {
                    curVao.attribBufferPointers(offsets[i]);
                    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, counts[i]);
                    context.stat.drawcalls++;
                }
            }
        } else {
            // multi draw arrays
            if (curVao.indexBuffer) {
                for (let j = 0; j < sz; j++) {
                    offsets[j] *= curVao.indexPerInstance * 4;
                    counts[j] *= curVao.indexPerInstance;
                }
            } else {
                for (let j = 0; j < sz; j++) {
                    offsets[j] *= curVao.vertexPerInstance;
                    counts[j] *= curVao.vertexPerInstance;
                }
            }

            if (md) {
                if (curVao.indexBuffer) {
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
                if (curVao.indexBuffer) {
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
        this.curVao = null;
    }
}
