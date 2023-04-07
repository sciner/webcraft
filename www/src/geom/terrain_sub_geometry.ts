import type {BigGeomBatchUpdate} from "./big_geom_batch_update.js";

export class TerrainSubGeometry {
    [key: string]: any;
    constructor({baseGeometry, pool, sizeQuads = 0, sizePages = 0}) {
        this.baseGeometry = baseGeometry;
        this.pool = pool;
        this.glOffsets = [];
        this.glCounts = [];
        this.pages = [];
        this.sizeQuads = sizeQuads;
        this.sizePages = sizePages;
    }

    setDataPages(vertices) {
        const {baseGeometry, pages, glOffsets, glCounts} = this;
        const {pageSize} = this.pool;
        this.sizeQuads = this.size = vertices[0];
        glOffsets.length = glCounts.length = 0;
        for (let i = 0; i < this.sizePages; i++) {
            const floatBuffer = new Float32Array(vertices[i + 1]);

            glOffsets.push(pages[i] * pageSize);
            glCounts.push(floatBuffer.length / baseGeometry.strideFloats);
            baseGeometry.updatePage(pages[i] * pageSize, floatBuffer);
        }
    }

    setDataBatch(batch: BigGeomBatchUpdate, vertices: any) {
        const {baseGeometry, pages, glOffsets, glCounts} = this;
        const {pageSize} = this.pool;
        this.sizeQuads = this.size = vertices[0];
        glOffsets.length = glCounts.length = 0;
        let pos = batch.pos;
        for (let i = 0; i < this.sizePages; i++) {
            const floatBuffer = new Float32Array(vertices[i + 1]);
            const sz = floatBuffer.length / baseGeometry.strideFloats;
            if (i > 0 && pages[i - 1] + 1 === pages[i]) {
                glCounts[glCounts.length - 1] += sz;
            } else {
                glOffsets.push(pages[i] * pageSize);
                glCounts.push(sz);
            }
            batch.addArrayBuffer(floatBuffer);
        }
        for (let i =0; i < glOffsets.length; i++) {
            batch.addCopy(pos, glOffsets[i], glCounts[i]);
            pos += glCounts[i];
        }
        baseGeometry.updateID++;
        // pages
    }

    destroy() {
        if (!this.pool) {
            return;
        }
        this.pool.dealloc(this);
    }
}