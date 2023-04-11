import type {BigGeomBatchUpdate, IGeomCopyOperation} from "./big_geom_batch_update.js";
import type {BaseBigGeometry} from "./base_big_geometry";
import type {BigGeometryPool} from "./big_geometry_pool";

export class TerrainSubGeometry implements IGeomCopyOperation {
    baseGeometry: BaseBigGeometry;
    pool: BigGeometryPool;
    glOffsets: number[] = [];
    glCounts: number[] = [];
    batchStart = 0;
    isDynamic = false;
    copyId = -1;
    pages: number[] = [];
    sizeQuads: number;
    sizePages: number;
    destroyed = false;
    size: number = 0;

    constructor({baseGeometry, pool, sizeQuads = 0, sizePages = 0}) {
        this.baseGeometry = baseGeometry;
        this.pool = pool;
        this.batchStart = -1;
        this.pages = [];
        this.sizeQuads = sizeQuads;
        this.sizePages = sizePages;
    }

    setDataBatch(batch: BigGeomBatchUpdate, vertices: any) {
        const {baseGeometry, pages, glOffsets, glCounts} = this;
        const {strideFloats} = baseGeometry.dynamicDraw;
        const {pageSize} = this.pool;
        this.sizeQuads = this.size = vertices[0];
        glOffsets.length = glCounts.length = 0;
        this.batchStart = batch.instCount;
        for (let i = 0; i < this.sizePages; i++) {
            const floatBuffer = new Float32Array(vertices[i + 1]);
            const sz = floatBuffer.length / strideFloats;
            if (i > 0 && pages[i - 1] + 1 === pages[i]) {
                glCounts[glCounts.length - 1] += sz;
            } else {
                glOffsets.push(pages[i] * pageSize);
                glCounts.push(sz);
            }
            batch.addArrayBuffer(floatBuffer);
        }
        if (!this.isDynamic) {
            this.isDynamic = true;
            batch.copies.push(this);
        }
    }

    destroy() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        this.pool.dealloc(this);
    }
}