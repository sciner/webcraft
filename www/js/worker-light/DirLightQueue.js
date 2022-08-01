import {MultiQueue} from "../light/MultiQueue.js";
import {
    BITS_QUEUE_BLOCK_INDEX, defPageSize, DIR_DOWN, dx, dz,
    MASK_QUEUE_BLOCK_INDEX,
    MASK_QUEUE_FORCE, MASK_SRC_AO, MASK_SRC_BLOCK,
    MASK_SRC_REST, maxLight, OFFSET_DAY, OFFSET_LIGHT,
    OFFSET_SOURCE
} from "./LightConst.js";

export class DirLightQueue {
    constructor(world, {offset, disperse}) {
        this.world = world;
        this.waves = new MultiQueue({pageSize: defPageSize, maxPriority: 256});
        // this.waves.debugName = 'DirLight';
        this.qOffset = offset || 4;
        this.disperse = disperse || 0;
    }

    add(chunk, coord, force) {
        const {outerSize} = chunk;
        let lvl = chunk.lightChunk.outerAABB.y_min + Math.floor(coord / outerSize.x / outerSize.z); // get Y
        this.waves.push(lvl, chunk.dataIdShift + coord + (force ? MASK_QUEUE_FORCE : 0));
        chunk.waveCounter++;
    }

    addWithChange(chunk, coord, force) {
        this.add(chunk, coord, force);
    }

    doIter(times) {
        const {waves, qOffset, disperse, world} = this;
        const {chunkById} = world.chunkManager;
        //TODO: recover nextWave
        //let nextWave = null;
        let chunk = null;

        let lightChunk = null;
        let uint8View = null;
        let outerSize = null;
        let strideBytes = 0;
        let outerAABB = null;
        let safeAABB = null;
        let portals = null;
        let dif26 = null;
        let chunkDataId = 0;
        let sx = 0, sy = 0, sz = 0;

        let curWave = null;
        for (let tries = 0; tries < times; tries++) {
            curWave = waves.peekNonEmpty();
            if (!curWave) {
                return true;
            }

            let coord = curWave.shift();
            const force = coord & MASK_QUEUE_FORCE;
            coord = coord & ~MASK_QUEUE_FORCE;
            const newChunk = chunkById[coord >> BITS_QUEUE_BLOCK_INDEX];
            coord = coord & MASK_QUEUE_BLOCK_INDEX;
            if (!newChunk || newChunk.removed) {
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
                chunkDataId = chunk.dataIdShift;
            }
            chunk.waveCounter--;

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
            const coordBytes = coord * strideBytes + qOffset;
            const old = uint8View[coordBytes + OFFSET_SOURCE];
            let val;
            if ((uint8View[coord * strideBytes + OFFSET_SOURCE] & MASK_SRC_REST) > 0) {
                val = 0;
            } else {
                val = uint8View[coordBytes + sy * strideBytes + OFFSET_SOURCE];
                if (disperse > 0) {
                    if (val === maxLight && val === old && !force) {
                        continue;
                    }
                    let cnt = 0;
                    for (let d = 0; d < 4; d++) {
                        if (uint8View[coordBytes + dif26[d] * strideBytes + OFFSET_SOURCE] === maxLight) {
                            cnt++;
                            if (uint8View[coordBytes + (dif26[d] + sy) * strideBytes + OFFSET_SOURCE] === maxLight) {
                                mask |= 1 << d;
                            }
                        }
                    }
                    if (val < maxLight) {
                        if (cnt > 0) {
                            val = Math.min(val + disperse, maxLight);
                        } else {
                            val = 0;
                        }
                    }
                }
            }
            if (old === val && !force) {
                continue;
            }
            let changedDisperse = (disperse > 0) && (((val === maxLight) ^ (old === maxLight)) || force);
            uint8View[coordBytes + OFFSET_SOURCE] = val;
            // add to queue for light calc
            let maxVal = uint8View[coordBytes + OFFSET_LIGHT];
            if (maxVal < val) {
                // mxdl-13 not obvious, good for big amount of lights
                maxVal = uint8View[coordBytes + OFFSET_LIGHT] = val;
                world.dayLight.add(chunk, coord, maxVal, world.getPotential(x, y, z), true);
                chunk.lastID++;
            } else {
                world.dayLight.add(chunk, coord, maxVal, world.getPotential(x, y, z));
            }
            //TODO: copy to neib chunks
            if (safeAABB.contains(x, y, z)) {
                // super fast case - we are inside data chunk
                waves.push(y - 1, chunkDataId + coord - sy);
                chunk.waveCounter++;
                if (changedDisperse) {
                    for (let d = 0; d < 4; d++) {
                        if ((mask & (1 << d)) !== 0) {
                            continue;
                        }
                        curWave.push(chunkDataId + coord + dif26[d]);
                        chunk.waveCounter++;
                    }
                }
            } else {
                for (let p = 0; p < portals.length; p++) {
                    const chunk2 = portals[p].toRegion;
                    if (!portals[p].aabb.contains(x, y, z)) {
                        continue;
                    }
                    const coord2 = chunk2.indexByWorld(x, y, z);
                    chunk2.setUint8ByInd(coord2, qOffset + OFFSET_SOURCE, val);
                    chunk2.setUint8ByInd(coord2, qOffset + OFFSET_LIGHT, maxVal);
                    let x2 = x,
                        y2 = y - 1,
                        z2 = z;
                    const dataIdShift2 = chunk2.rev.dataIdShift;
                    if (chunk2.aabb.contains(x2, y2, z2)) {
                        waves.push(y - 1, dataIdShift2 + chunk2.indexByWorld(x2, y2, z2));
                        chunk2.rev.waveCounter++;
                        mask |= (1 << DIR_DOWN); //down
                    }
                    if (changedDisperse) {
                        for (let d = 0; d < 4; d++) {
                            if ((mask & (1 << d)) !== 0) {
                                continue;
                            }
                            x2 = x + dx[d];
                            y2 = y;
                            z2 = z + dz[d];
                            if (chunk2.aabb.contains(x2, y2, z2)) {
                                mask |= 1 << d;
                                curWave.push(dataIdShift2 + chunk2.indexByWorld(x2, y2, z2));
                                chunk2.rev.waveCounter++;
                            }
                        }
                    }
                }
                if ((mask & (1 << DIR_DOWN)) === 0) {
                    let x2 = x,
                        y2 = y - 1,
                        z2 = z;
                    let coord2 = coord - sy;
                    if (lightChunk.aabb.contains(x2, y2, z2)) {
                        waves.push(y - 1, chunkDataId + coord2);
                        chunk.waveCounter++;
                    }
                }
                if (changedDisperse) {
                    for (let d = 0; d < 4; d++) {
                        if ((mask & (1 << d)) !== 0) {
                            continue;
                        }
                        let x2 = x + dx[d],
                            y2 = y,
                            z2 = z + dz[d];
                        let coord2 = coord + dif26[d];
                        if (lightChunk.aabb.contains(x2, y2, z2)) {
                            curWave.push(chunkDataId + coord2);
                            chunk.waveCounter++;
                        }
                    }
                }
            }
        }
        waves.peekNonEmpty();
        return false;
    }

    fillOuter(chunk) {
        const {world} = this;
        const {lightChunk} = chunk;
        const {outerSize, portals, aabb, uint8View, strideBytes, safeAABB, dif26} = lightChunk;
        const {shiftCoord, cx, cy, cz} = lightChunk;

        const defLight = lightChunk.pos.y >= 0 ? world.defDayLight : 0;

        // set day light from up
        for (let z = aabb.z_min; z < aabb.z_max; z++)
            for (let x = aabb.x_min; x < aabb.x_max; x++) {
                let coord = x * cx + z * cz + shiftCoord + cy * aabb.y_max;
                uint8View[coord * strideBytes + OFFSET_DAY + OFFSET_SOURCE] = defLight;
            }
        let upPortal = false;
        let foundDay = false;
        const disperse = world.dayLightSrc.disperse;
        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            const other = portal.toRegion;
            const p = portal.aabb;
            const inside2 = other.aabb;
            const bytes2 = other.uint8View;
            const cy2 = other.cy, cx2 = other.cx, cz2 = other.cz, shift2 = other.shiftCoord;

            if (other.aabb.y_min > aabb.y_min) {
                upPortal = true;
            }
            for (let x = p.x_min; x < p.x_max; x++)
                for (let y = p.y_min; y < p.y_max; y++)
                    for (let z = p.z_min; z < p.z_max; z++) {
                        const coord1 = (cx * x + cy * y + cz * z + shiftCoord) * strideBytes;
                        const coord2 = (cx2 * x + cy2 * y + cz2 * z + shift2) * strideBytes;
                        //TODO: optimize contains here?
                        const f1 = aabb.contains(x, y, z);
                        const f2 = inside2.contains(x, y, z);
                        const dayLight = bytes2[coord2 + OFFSET_DAY + OFFSET_LIGHT];
                        const dayLightSrc = bytes2[coord2 + OFFSET_DAY + OFFSET_SOURCE];
                        // daylight
                        uint8View[coord1 + OFFSET_DAY + OFFSET_LIGHT] = dayLight;

                        if (f2 || f1 && dayLightSrc > 0) {
                            uint8View[coord1 + OFFSET_DAY + OFFSET_SOURCE] = dayLightSrc;
                        }
                        if (f2 && dayLightSrc !== defLight) {
                            foundDay = true;
                        }
                    }
        }
        if (upPortal) {
            // fix for black chunks in case respawn above y=80
            // there's a chunk above us => dont try to upload texture before the queue goes down to center of chunk
            this.add(chunk, (outerSize.x >> 1) * cx + (outerSize.z >> 1) * cz + (outerSize.y >> 1) * cy);
        }
        // check if there're actually any blocks
        if (!foundDay) {
            outerCycle: for (let y = aabb.y_min; y < aabb.y_max; y++)
                for (let z = aabb.z_min; z < aabb.z_max; z++)
                    for (let x = aabb.x_min; x < aabb.x_max; x++) {
                        const coord = x * cx + y * cy + z * cz + shiftCoord;
                        if  ((uint8View[coord * strideBytes + OFFSET_SOURCE] & MASK_SRC_REST) > 0) {
                            foundDay = true;
                            break outerCycle;
                        }
                    }
        }

        if (foundDay) {
            chunk.lastID++;
            for (let y = aabb.y_min; y < aabb.y_max; y++)
                for (let z = aabb.z_min; z < aabb.z_max; z++)
                    for (let x = aabb.x_min; x < aabb.x_max; x++) {
                        if (safeAABB.contains(x, y, z)) {
                            continue;
                        }
                        const coord = x * cx + y * cy + z * cz + shiftCoord, coordBytes = coord * strideBytes;
                        if (uint8View[coordBytes + cy * strideBytes + OFFSET_DAY + OFFSET_SOURCE] > 0) {
                            this.add(chunk, coord);
                        } else /* if (disperse > 0) */ // somehow there's a bug with this thing
                        {
                            for (let d = 0; d < 4; d++) {
                                if (uint8View[(coord + dif26[d]) * strideBytes + OFFSET_DAY + OFFSET_SOURCE] === maxLight) {
                                    this.add(chunk, coord);
                                    break;
                                }
                            }
                        }
                        let m = uint8View[coordBytes + OFFSET_LIGHT];
                        for (let d = 0; d < 6; d++) {
                            m = Math.max(m, uint8View[(coord + dif26[d]) * strideBytes + OFFSET_DAY + OFFSET_LIGHT]);
                        }
                        if (m > 0) {
                            world.dayLight.add(chunk, coord, m, world.getPotential(x, y, z));
                        }
                    }
        } else {
            if (defLight > 0) {
                for (let y = aabb.y_min; y < aabb.y_max; y++)
                    for (let z = aabb.z_min; z < aabb.z_max; z++)
                        for (let x = aabb.x_min; x < aabb.x_max; x++) {
                            const coord = x * cx + y * cy + z * cz + shiftCoord,
                                coordBytes = coord * strideBytes + OFFSET_DAY
                            uint8View[coordBytes + OFFSET_SOURCE] = defLight;
                            uint8View[coordBytes + OFFSET_LIGHT] = defLight
                        }
                // copy found dayLight to portals
                for (let i = 0; i < portals.length; i++) {
                    const portal = portals[i];
                    const other = portal.toRegion;
                    const p = portal.aabb;
                    const bytes2 = other.uint8View;
                    const cy2 = other.cy, cx2 = other.cx, cz2 = other.cz, shift2 = other.shiftCoord;

                    for (let x = p.x_min; x < p.x_max; x++)
                        for (let y = p.y_min; y < p.y_max; y++)
                            for (let z = p.z_min; z < p.z_max; z++) {
                                if (aabb.contains(x, y, z)) {
                                    const coord2 = (cx2 * x + cy2 * y + cz2 * z + shift2) * strideBytes + OFFSET_DAY;
                                    bytes2[coord2 + OFFSET_SOURCE] = defLight;
                                    bytes2[coord2 + OFFSET_LIGHT] = defLight;
                                }
                            }
                }
            }
        }
    }
}
