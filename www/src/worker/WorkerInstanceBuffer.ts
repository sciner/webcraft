import {Worker05SubGeometry} from "../light/Worker05GeometryPool.js";

export class WorkerInstanceBuffer {
    [key: string]: any;
    constructor({
                    material_key,
                    geometryPool,
                    chunkDataId,
                }) {
        this.material_key = material_key;
        this.geometryPool = geometryPool;
        this.chunkDataId = chunkDataId;
        this.vertices = null;
        this.cacheVertices = null;
        this.cachePos = 0;
        this.cacheCopy = 0;
        this.touched = false;
        this.serialized = null;
    }

    initGeom() {
        this.cacheVertices = this.vertices;
        this.vertices = new Worker05SubGeometry({
            pool: this.geometryPool,
            chunkDataId: this.chunkDataId
        })
    }

    markClear() {
        this.touched = false;
        if (this.cacheVertices) {
            this.cacheVertices.clear();
            this.cacheVertices = null;
            this.cachePos = 0;
            this.cacheCopy = 0;
        }
        this.serialized = null;
    }

    clear() {
        this.vertices.clear();
    }

    touch() {
        if (this.touched) {
            return this.vertices;
        }
        this.touched = true;
        this.initGeom();
        this.serialized = {
            list: []
        };
        return this.vertices;
    }

    getSerialized() {
        const s = this.serialized;
        const {pages, lastPage} = this.vertices;
        s.list.push(this.vertices.filled);
        for (let i = 0; i + 1 < pages.length; i++) {
            s.list.push(pages[i].data.buffer);
        }
        if (lastPage) {
            const len = lastPage.filled * lastPage.instanceSize;
            s.list.push(lastPage.data.slice(0, len).buffer);
        }
        return s;
    }

    skipCache(amount) {
        const { pageSize } = this.geometryPool;
        while (this.cacheCopy > 0) {
            const pageNum = Math.floor(this.cachePos / pageSize);
            const instNum = this.cachePos % pageSize;
            const { data } = this.cacheVertices.pages[pageNum];
            const cnt = Math.min(this.cacheCopy, pageSize - instNum);
            this.vertices.pushData(data, instNum, cnt);
            this.cacheCopy -= cnt;
            this.cachePos += cnt;
        }
        this.cachePos += amount;
    }

    copyCache(amount) {
        this.cacheCopy += amount;
    }
}