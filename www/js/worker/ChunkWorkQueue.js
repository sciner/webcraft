import { Vector, VectorCollector } from "../helpers.js";

const revChunkSort = (a, b) => {
    return b.queueDist - a.queueDist;
}

/**
 * Queue either for generator either for buildVertices
 */
export class ChunkWorkQueue {
    constructor(world) {
        this.world = world;
        this.added = [];
        this.entries = [];
        this.potentialCenter = null;

        this.lastSortMs = performance.now() - 1000;
        this.maxSortTime = 15; // in ms
        this.needSort = false;

        this.hitZero = false;
    }

    size() {
        return this.added.length + this.entries.length;
    }

    calcDist(chunk) {
        const {potentialCenter} = this;
        if (!potentialCenter) {
            chunk.queueDist = 0;
            return;
        }
        const {coord, size} = chunk;

        //TODO: make AABB here instead
        let dx = 0;
        let dy = 0;
        let dz = 0;
        if (potentialCenter.x < coord.x) {
            dx = coord.x - potentialCenter.x;
        } else
        if (potentialCenter.x > coord.x + size.x) {
            dx = potentialCenter.x - (coord.x + size.x);
        }
        if (potentialCenter.y < coord.y) {
            dy = coord.y - potentialCenter.y;
        } else
        if (potentialCenter.y > coord.y + size.y) {
            dy = potentialCenter.y - (coord.y + size.y);
        }
        if (potentialCenter.z < coord.z) {
            dz = coord.z - potentialCenter.z;
        } else
        if (potentialCenter.z > coord.z + size.z) {
            dz = potentialCenter.z - (coord.z + size.z);
        }

        chunk.queueDist = dx + dy + dz;
        if (chunk.inited) {
            // its build queue!
            let portalReady = 0;
            for (let i = 0; i < chunk.dataChunk.facetPortals.length; i++) {
                portalReady++;
            }
            if (portalReady < 6) {
                chunk.queueDist += 100;
            }
        }
    }

    push(chunk) {
        const {entries} = this;
        chunk.inQueue = true;
        this.calcDist(chunk);

        // look last 10 entries, put it there, in case its the best chunk
        let bestDist = entries.length > 0 ? entries[entries.length - 1].queueDist : 10000;
        if (chunk.queueDist < bestDist + 32) {
            // add here now
            this.entries.push(chunk);
        } else {
            this.added.push(chunk);
        }
        this.hitZero = false;
    }

    relaxEntries() {
        const now = performance.now();
        const {added, entries} = this;
        if (entries.length === 0 || this.lastSortMs + this.maxSortTime >= now && added.length < 15) {
            // debounce
            return;
        }
        this.lastSortMs = now;
        let j = 0;
        for (let i = 0; i < entries.length; i++) {
            if (!entries[i].destroyed) {
                this.calcDist(entries[i]);
                entries[j++] = entries[i];
            }
        }
        for (let i = 0; i < added.length; i++) {
            if (!added[i].destroyed) {
                this.calcDist(added[i]);
                entries[j++] = added[i];
            }
        }
        entries.length = j;
        added.length = 0;
        entries.sort(revChunkSort);
    }

    pop() {
        const {added, entries} = this;
        while (entries.length > 0) {
            const e = entries.pop();
            e.inQueue = false;
            if (e.destroyed) {
                continue;
            }
            return e;
        }
        while (added.length > 0) {
            const e = added.pop();
            e.inQueue = false;
            if (e.destroyed) {
                continue;
            }
            return e;
        }
        return null;
    }
}