import {DRAW_MODES, ExtensionType} from "vauxcel";
import {MultiDrawBuffer} from "./multi_draw_buffer.js";
import {ObjectDrawer} from "../batch/ObjectDrawer.js";

export class GLChunkDrawer extends ObjectDrawer {
    static extension = {
        name: 'chunk',
        type: ExtensionType.RendererPlugin,
    };

    curMat: any = null;
    curVao: any = null;
    elements = [];
    count = 0;

    constructor(context) {
        super(context);
    }

    mdb = new MultiDrawBuffer();

    draw(geom, material, chunk) {
        const {context, renderer} = this;
        if (geom.size === 0 || geom.glCounts && geom.glCounts.length === 0) {
            return;
        }

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
            renderer.geometry.draw(DRAW_MODES.TRIANGLES, 6, 0, geom.size);
            // stat
            context.stat.drawquads += geom.size;
            context.stat.drawcalls++;
        }
    }

    flush() {
        if (this.count === 0) {
            return;
        }
        let {context, elements} = this;
        const {pixiRender} = context;
        let sz = 0;
        let curVao = this.curVao;
        let totalLen = 0;
        for (let i = 0; i < this.count; i++) {
            totalLen += elements[i].glOffsets.length;
        }
        this.mdb.ensureSize(totalLen);

        const {offsets, offsetsInt, counts} = this.mdb;

        for (let i = 0; i < this.count; i++) {
            const geom = elements[i];
            elements[i] = null;
            const len = geom.glOffsets.length;
            if (geom.batchStatus > 0) {
                offsets[sz] = geom.batchStart;
                counts[sz] = geom.sizeQuads;
                if ((offsets[sz] + counts[sz]) * curVao.stride > curVao.buffer.byteLength) {
                    console.log("glOffsets problem");
                }
                sz++;
            } else {
                for (let j = 0; j < len; j++) {
                    offsets[sz] = geom.glOffsets[j];
                    counts[sz] = geom.glCounts[j];
                    if ((offsets[sz] + counts[sz]) * curVao.stride > curVao.buffer.byteLength) {
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
        const {arrZeros, arrSixes} = this.mdb;

        if (curVao.hasInstance) {
            pixiRender.geometry.multiDrawArraysBVBI(DRAW_MODES.TRIANGLES,
                arrZeros, arrSixes, counts, offsets, sz);
            if (mdb) {
                context.stat.multidrawcalls++;
            } else {
                context.stat.drawcalls += sz;
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
                    // pixiRender.geometry.draw(DRAW_MODES.TRIANGLES, 3, 0);
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
