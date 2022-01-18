import { BaseChunk } from "./chunk/BaseChunk";
import {
    DIR_COUNT,
    DLEN,
    DMASK,
    DX,
    DY,
    DZ,
    MASK_BLOCK,
    maxLight,
    OFFSET_LIGHT,
    OFFSET_PREV,
    OFFSET_SOURCE
} from "./constants";

export class Vector {

}

export class LightQueue {
    wavesChunk: StaticArray<Array<BaseChunk>>;
    wavesCoord: StaticArray<Array<i32>>;
    qOffset: i32 = 0;
    dirCount: u32 = 6;

    constructor(offset: i32, dirCount: u32) {
        this.wavesChunk = new StaticArray<Array<BaseChunk>>(maxLight);
        this.wavesCoord = new StaticArray<Array<i32>>(maxLight);

        for (let i = 0; i <= maxLight; i++) {
            this.wavesChunk[i] = [];
            this.wavesCoord[i] = [];
        }

        this.qOffset = offset || 0;
        this.dirCount = dirCount || DIR_COUNT;
    }

    doIter(times: u32): boolean {
        const wavesChunk = this.wavesChunk;
        const wavesCoord = this.wavesCoord;
        const qOffset    = this.qOffset;
        const dirCount   = this.dirCount;
        
        let wn = maxLight;

        let chunk = null;
        let lightChunk = null;
        let uint8View = null;
        let outerSize = null;
        let strideBytes = 0;
        let outerAABB = null;
        let safeAABB = null;
        let portals = null;
        let dif26 = null;
        let sx = 0, sy = 0, sz = 0;

        for (let tries = 0; tries < times; tries++) {
            while (wn >= 0 && wavesChunk[wn].length === 0) {
                wn--;
            }
            if (wn < 0) {
                return true;
            }
            let newChunk = wavesChunk[wn].pop();
            const coord = wavesCoord[wn].pop();
            newChunk.waveCounter--;
            if (newChunk.removed) {
                continue;
            }
            if (chunk !== newChunk) {
                chunk = newChunk;
                lightChunk = chunk.lightChunk;
                uint8View = lightChunk.uint8View;
                outerSize = lightChunk.outerSize;
                strideBytes = lightChunk.strideBytes;
                outerAABB = lightChunk.outerAABB;
                safeAABB = lightChunk.safeAABB;
                portals = lightChunk.portals;
                dif26 = lightChunk.dif26;
                sx = 1;
                sz = outerSize.x;
                sy = outerSize.x * outerSize.z;
            }

            const coordBytes = coord * strideBytes + qOffset;

            let tmp = coord;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;
            x += outerAABB.x_min;
            y += outerAABB.y_min;
            z += outerAABB.z_min;

            let mask = 0;
            let val = uint8View[coordBytes + OFFSET_SOURCE];
            const old = uint8View[coordBytes + OFFSET_LIGHT];
            const prev = uint8View[coordBytes + OFFSET_PREV];
            if (uint8View[coord * strideBytes + OFFSET_SOURCE] === MASK_BLOCK) {
                val = 0;
            } else {
                if (val === maxLight && val === old && val === prev)
                {
                    continue;
                }
                for (let d = 0; d < dirCount; d++) {
                    if ((mask & (1 << d)) !== 0) {
                        // if (d >= 6 && mask >= DIR_MAX_MASK) {
                        //     break;
                        // }
                        continue;
                    }
                    let coord2 = coord + dif26[d];
                    let light = uint8View[coord2 * strideBytes + qOffset + OFFSET_LIGHT];
                    if (uint8View[coord2 * strideBytes + OFFSET_SOURCE] === MASK_BLOCK) {
                        light = 0;
                        mask |= DMASK[d];
                    }
                    val = Math.max(val, light - DLEN[d]);
                }
            }
            if (old === val && prev === val) {
                continue;
            }
            uint8View[coordBytes + OFFSET_LIGHT] = val;
            uint8View[coordBytes + OFFSET_PREV] = val;
            chunk.lastID++;

            //TODO: copy to neib chunks

            // TODO: swap -1 to real -dlen
            const waveNum = Math.max(Math.max(old, val) - 1, 0);
            if (safeAABB.contains(x, y, z)) {
                // super fast case - we are inside data chunk
                for (let d = 0; d < dirCount; d++) {
                    if ((mask & (1 << d)) !== 0) {
                        continue;
                    }
                    let coord2 = coord + dif26[d];
                    const light = uint8View[coord2 * strideBytes + qOffset + OFFSET_LIGHT];
                    // a4fa-12 , not obvious optimization
                    if (light >= prev && light >= val && light >= old) {
                        continue;
                    }
                    wavesChunk[waveNum].push(chunk);
                    wavesCoord[waveNum].push(coord2);
                    chunk.waveCounter++;
                }
            } else {
                let mask2 = 0;
                for (let p = 0; p < portals.length; p++) {
                    const chunk2 = portals[p].toRegion;
                    if (!portals[p].aabb.contains(x, y, z)) {
                        continue;
                    }
                    mask2 |= 1 << p;
                    chunk2.setUint8ByInd(chunk2.indexByWorld(x, y, z), qOffset + OFFSET_LIGHT, val);
                    chunk2.rev.lastID++;
                    for (let d = 0; d < DIR_COUNT; d++) {
                        if ((mask & (1 << d)) !== 0) {
                            continue;
                        }
                        let x2 = x + DX[d],
                            y2 = y + DY[d],
                            z2 = z + DZ[d];
                        if (chunk2.aabb.contains(x2, y2, z2)) {
                            const coord2 = chunk2.indexByWorld(x2, y2, z2);
                            const light = chunk2.uint8ByInd(coord2, qOffset + OFFSET_LIGHT);
                            mask |= 1 << d;
                            // a4fa-12 , not obvious optimization
                            if (light >= prev && light >= val && light >= old) {
                                continue;
                            }
                            wavesChunk[waveNum].push(chunk2.rev);
                            wavesCoord[waveNum].push(coord2);

                            chunk2.rev.waveCounter++;
                        }
                    }
                }
                for (let d = 0; d < dirCount; d++) {
                    if ((mask & (1 << d)) !== 0) {
                        continue;
                    }
                    let x2 = x + DX[d],
                        y2 = y + DY[d],
                        z2 = z + DZ[d];
                    let coord2 = coord + dif26[d];
                    if (lightChunk.aabb.contains(x2, y2, z2)) {
                        wavesChunk[waveNum].push(chunk);
                        wavesCoord[waveNum].push(coord2);
                        chunk.waveCounter++;
                    }
                }
            }
        }
        return false;
    }

    /**
     * @param chunk
     * @param coord
     * @param waveNum
     */
    add(chunk: BaseChunk, coord: i32, waveNum: u32): void {
        const wavesChunk = this.wavesChunk;
        const wavesCoord = this.wavesCoord;

        if (waveNum < 0 || waveNum > maxLight) {
            waveNum = maxLight;
        }

        wavesChunk[waveNum].push(chunk);
        wavesCoord[waveNum].push(coord);

        chunk.waveCounter++;
    }
}