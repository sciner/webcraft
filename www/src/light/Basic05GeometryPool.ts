import {TerrainSubGeometry} from "./TerrainSubGeometry.js";
import {TerrainMultiGeometry} from "./TerrainMultiGeometry.js";
import {GeometryPool} from "./GeometryPool.js";
import type {BaseMultiGeometry} from "../geom/BaseMultiGeometry";

export class Basic05GeometryPool extends GeometryPool {
    [key: string]: any;
    baseGeometry: BaseMultiGeometry;
    constructor(context, {
        pageSize = 256,
        pageCount = 1000,
        growCoeff = 1.5
    }) {
        super(context)

        this.growCoeff = growCoeff;
        this.pageCount = pageCount;
        this.pageSize = pageSize;
        this.freePages = [];
        for (let i = pageCount - 1; i >= 0; i--) {
            this.freePages.push(i);
        }

        this.initBaseGeometry();
    }

    initBaseGeometry() {
        this.baseGeometry = new TerrainMultiGeometry({
            context: this.context, size: this.pageCount * this.pageSize
        })
    }

    grow() {
        const {pageSize, growCoeff, freePages} = this;
        const prevSize = this.pageCount;
        const newSize = this.pageCount = Math.ceil(prevSize * growCoeff);
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
        const {pos, heuristicSize} = this.baseGeometry.batch;
        return !this.baseGeometry.copyReady && (pos <= heuristicSize / 10 || pos + instances <= heuristicSize);
    }

    prepareMem(instances: number) {
        const {batch} = this.baseGeometry;
        batch.ensureSize(batch.pos + instances);
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