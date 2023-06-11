import {TerrainSubGeometry} from "./terrain_sub_geometry.js";
import {TerrainBigGeometry} from "./terrain_big_geometry.js";
import {BaseGeometryPool} from "./base_geometry_pool.js";
import type {BaseBigGeometry} from "./base_big_geometry";
import {TerrainGeometryVao} from "./terrain_geometry_vao.js";

export class BigGeometryPool extends BaseGeometryPool {
    growCoeff: number;
    growMaxPageInc: number;
    pageCount: number;
    pageSize: number;
    freePages: number[];
    baseGeometry: BaseBigGeometry;
    constructor(context, {
        pageSize = 256,
        pageCount = 1000,
        initSizeMegabytes = 0,
        growCoeff = 2.0,
        growMaxPageInc = 8000,
    }) {
        super(context)

        this.growCoeff = growCoeff;
        this.growMaxPageInc = growMaxPageInc;
        this.pageCount = pageCount;

        if (initSizeMegabytes > 0) {
            this.pageCount = Math.max(pageCount,
                Math.ceil(initSizeMegabytes * 1024 * 1024 / pageSize / (TerrainGeometryVao.strideFloats * 4)));
        }

        this.pageSize = pageSize;
        this.freePages = [];
        for (let i = this.pageCount - 1; i >= 0; i--) {
            this.freePages.push(i);
        }

        this.initBaseGeometry();
    }

    initBaseGeometry() {
        this.baseGeometry = new TerrainBigGeometry({
            staticSize: this.pageCount * this.pageSize,
            dynamicSize: 1 << 14,
        })
    }

    get bufferSizeBytes() {
        return this.baseGeometry.staticDraw.buffer.byteLength;
    }

    grow() {
        const {pageSize, growCoeff, freePages} = this;
        const prevSize = this.pageCount;
        const newSize = this.pageCount = Math.min(prevSize + this.growMaxPageInc, Math.ceil(prevSize * growCoeff));
        this.baseGeometry.resize(newSize * pageSize);
        for (let i = newSize - 1; i >= prevSize; i--) {
            freePages.push(i);
        }
    }

    alloc({lastBuffer = null, vertices = null, chunkId = -1} = {}) {
        const {freePages, pageSize, baseGeometry} = this;
        const {batch} = baseGeometry;
        const sizeQuads = vertices[0];
        const sizePages = Math.ceil(sizeQuads / pageSize);
        const lastSize = lastBuffer ? lastBuffer.sizePages : 0;
        let sub = lastBuffer;
        if (!sub || !sub.pool) {
            sub = new TerrainSubGeometry({
                pool: this, baseGeometry, sizeQuads, sizePages
            });
        } else {
            sub.sizePages = sizePages;
        }
        const {pages} = sub;
        if (sizePages < lastSize) {
            for (let i = 0; i < lastSize - sizePages; i++) {
                freePages.push(pages.pop());
            }
        } else if (sizePages > lastSize) {
            while (freePages.length < sizePages - lastSize) {
                this.grow();
            }
            for (let i = 0; i < sizePages - lastSize; i++) {
                pages.push(freePages.pop());
            }
        }

        sub.setDataBatch(batch, vertices);

        return sub;
    }

    /**
     * heuristic whether there's a place in batch for new vertices
     * @param instances
     */
    checkHeuristicSize(instances) {
        const heuristicSize = this.baseGeometry.dynamicSize;
        const pos = this.baseGeometry.batch.instCount;
        return pos <= heuristicSize / 10 || pos + instances <= heuristicSize;
    }

    prepareMem(instances: number) {
        const {batch} = this.baseGeometry;
        batch.ensureSize(batch.instCount + instances);
    }

    dealloc(buffer) {
        const {freePages} = this;
        const {pages} = buffer;
        if (buffer.pool !== this) {
            return;
        }
        for (let i = pages.length - 1; i >= 0; i--) {
            freePages.push(pages[i]);
        }
        buffer.pool = null;
    }
}