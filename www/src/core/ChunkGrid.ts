import type {DataChunk} from "./DataChunk.js";
import { VectorCollector, Vector } from "../helpers.js";
import {AABB} from "./AABB.js";
import {Portal} from "./BaseChunk.js";
import {ChunkGridMath, getCachedChunkGridMath} from "./ChunkGridMath.js";

export const dx = [1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1];
export const dy = [0, 0, 0, 0, 1, -1, /*|*/ 1, 1, -1, -1, 0, 0, 0, 0, 1, 1, -1, -1, /*|*/ 1, 1, -1, -1, 1, 1, -1, -1];
export const dz = [0, 0, 1, -1, 0, 0, /*|*/ 0, 0, 0, 0, 1, 1, -1, -1, 1, -1, 1, -1, /*|*/ 1, 1, 1, 1, -1, -1, -1, -1];

declare type ChunkGridOptions = {
    chunkSize: Vector,
    chunkPadding? : int
}

/*
 * May contain a topology and not actual data
 *
 * for inner map uses special addresses for chunk
 */
export class ChunkGrid {
    static operationID = 0;

    innerMap = new VectorCollector<DataChunk>();
    chunkSize: Vector;
    chunkPadding: number;
    math: ChunkGridMath;
    outerSize: Vector;
    chunkDefaultAABB: AABB;

    constructor(options : ChunkGridOptions) {
        let {chunkSize, chunkPadding} = options
        if(!chunkSize) {
            throw 'error_invalid_chunk_size'
        }
        this.chunkSize = new Vector().copyFrom(chunkSize)
        const padding = this.chunkPadding = chunkPadding ?? 1
        this.outerSize = this.outerSize = new Vector(chunkSize.x + padding * 2, chunkSize.y + padding * 2, chunkSize.z + padding * 2);
        this.chunkDefaultAABB = new AABB(0, 0, 0, chunkSize.x, chunkSize.y, chunkSize.z);

        // TODO: index function should be baked in special cache!
        this.math = getCachedChunkGridMath(chunkSize);
    }

    initSize(chunkSize) {

    }

    get(vec: Vector): DataChunk | null {
        return this.innerMap.get(vec);
    }

    set(vec: Vector, value: DataChunk): void {
        this.innerMap.set(vec, value);
    }

    delete(vec: Vector): boolean {
        return this.innerMap.delete(vec);
    }

    /**
     * Возвращает адрес чанка по глобальным абсолютным координатам
     */
    getChunkAddr(x: number, y: number, z: number, out_vec ? : Vector) {
        const {chunkSize} = this;
        out_vec = out_vec || new Vector();
        out_vec.x = Math.floor(x / chunkSize.x);
        out_vec.y = Math.floor(y / chunkSize.y);
        out_vec.z = Math.floor(z / chunkSize.z);
        // Fix negative zero
        if (out_vec.x == 0) {
            out_vec.x = 0;
        }
        if (out_vec.y == 0) {
            out_vec.y = 0;
        }
        if (out_vec.z == 0) {
            out_vec.z = 0;
        }
        return out_vec;
    }

    toChunkAddr(in_vec: IVector, out_vec ? : Vector): Vector {
        out_vec = out_vec || new Vector()
        return this.getChunkAddr(in_vec.x, in_vec.y, in_vec.z, out_vec)
    }

    chunkAddrToCoord(addr: IVector, out_vec? : Vector) : Vector {
        const {chunkSize} = this;
        out_vec = out_vec || new Vector();
        out_vec.x = addr.x * chunkSize.x;
        out_vec.y = addr.y * chunkSize.y;
        out_vec.z = addr.z * chunkSize.z;
        return out_vec;
    }

    getChunkCenterByAddr(in_vec: IVector, out_vec? : Vector) : Vector {
        const {chunkSize} = this;
        out_vec = out_vec || new Vector();
        out_vec.x = (in_vec.x * chunkSize.x) + (chunkSize.x >> 1);
        out_vec.y = (in_vec.y * chunkSize.y) + (chunkSize.y >> 1);
        out_vec.z = (in_vec.z * chunkSize.z) + (chunkSize.z >> 1);
        return out_vec;
    }

    getXYZ(x: number, y: number, z: number): DataChunk | null {
        return this.innerMap.list.get(x)?.get(y)?.get(z);
    }

    addSub(sub: DataChunk) {
        let addr = this.toChunkAddr(sub.pos);
        this.innerMap.add(addr, sub);
        for (let i = 0; i < 26; i++) {
            const neib = this.getXYZ(addr.x + dx[i], addr.y + dy[i], addr.z + dz[i]);
            if (!neib) {
                continue;
            }
            const aabb = new AABB().setIntersect(sub.outerAABB, neib.outerAABB);
            const portal1 = new Portal({
                aabb,
                fromRegion: sub,
                toRegion: neib
            })
            const portal2 = new Portal({
                aabb,
                fromRegion: neib,
                toRegion: sub
            })
            portal1.rev = portal2;
            portal2.rev = portal1;
            sub._addPortal(portal1);
            neib._addPortal(portal2);
        }
    }

    removeSub(sub: DataChunk) {
        let addr = this.toChunkAddr(sub.pos);
        if (this.get(addr) !== sub) {
            return;
        }
        this.innerMap.delete(addr);
        sub._removeAllPortals();
    }

    removeMultiple(arr: Array<DataChunk>, chunkHandler?: (Chunk) => void, portalHandler?: (Portal) => void) {
        const deleteOp = ++ChunkGrid.operationID;
        for (let i = 0; i < arr.length; i++) {
            arr[i].markDeleteId = deleteOp;
        }
        for (let i = 0; i < arr.length; i++) {
            const {portals} = arr[i];
            for (let j = 0; j < portals.length; j++) {
                const neib = portals[j].toRegion;
                if (neib.markDeleteId !== 0
                    || neib.lastOpID === deleteOp) {
                    continue;
                }
                neib.cleanPortals(portalHandler);
                neib.lastOpID = deleteOp;
            }
        }
        if (chunkHandler) {
            arr.forEach(chunkHandler);
        }
        let addr = new Vector();
        for (let i = 0; i < arr.length; i++) {
            arr[i].portals.length = 0;
            arr[i].facetPortals.length = 0;
            arr[i].markDeleteId = 0;
            this.innerMap.delete(this.toChunkAddr(arr[i].pos, addr));
        }
    }
}
