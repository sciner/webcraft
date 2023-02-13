import {MultiQueue} from "../light/MultiQueue.js";
import {
    BITS_QUEUE_BLOCK_INDEX, defPageSize, DIR_DOWN, dx, dy, dz,
    MASK_QUEUE_BLOCK_INDEX,
    MASK_QUEUE_FORCE, MASK_SRC_BLOCK,
    MASK_SRC_REST, maxLight, OFFSET_COLUMN_BOTTOM, OFFSET_COLUMN_DAY, OFFSET_COLUMN_TOP, OFFSET_DAY, OFFSET_LIGHT,
    OFFSET_SOURCE
} from "./LightConst.js";

export class DirNibbleQueue {
    [key: string]: any;
    constructor(world, {offset, disperse}) {
        this.world = world;
        this.waves = new MultiQueue({pageSize: defPageSize, maxPriority: 256});
        this.qOffset = offset || 0;
        this.disperse = disperse || 0;
    }

    add(chunk, coord, force = false) {
        const {lightChunk} = chunk;
        const {nibbleDims, cy, padding} = lightChunk;
        if (!nibbleDims) {
            return;
        }
        const nibDim = nibbleDims.y;
        const localY = Math.floor(coord / cy) - padding;
        const nibY = Math.floor(localY / nibDim);
        const lvl = nibY * nibDim + chunk.lightChunk.aabb.y_min;
        const nibCoord = coord + (nibY - localY) * cy;

        this.waves.push(lvl, chunk.dataIdShift + nibCoord + (force ? MASK_QUEUE_FORCE : 0));
        chunk.waveCounter++;
    }

    addDirect(chunk, nibCoord, force = false) {
        const {lightChunk} = chunk;
        const {nibbleDims, cy, padding} = lightChunk;
        if (!nibbleDims) {
            return;
        }
        const nibDim = nibbleDims.y;
        const nibY = Math.floor(nibCoord / cy) - padding;
        const lvl = nibY * nibDim + chunk.lightChunk.aabb.y_min;

        this.waves.push(lvl, chunk.dataIdShift + nibCoord + (force ? MASK_QUEUE_FORCE : 0));
        chunk.waveCounter++;
    }

    addWithChange(chunk, coord, force = false) {
        //block was changed! recalc column right now!
        const {lightChunk} = chunk;
        const {nibbleDims} = lightChunk;
        if (!nibbleDims) {
            return;
        }
        const nibDim = nibbleDims.y;
        const {padding, nibbleStrideBytes, strideBytes, cy, nibbleSize, uint8View, nibbles, size} = lightChunk;
        const localY = Math.floor(coord / cy) - padding;
        const nibY = Math.floor(localY / nibDim);
        const lvl = nibY * nibDim + chunk.lightChunk.aabb.y_min;
        const nibCoord = (coord + (nibY - localY) * cy) * nibbleStrideBytes;
        const height = Math.min(nibDim, size.y - nibY * nibDim);
        let blockCoord = (coord + (nibY * nibDim - localY) * cy) * strideBytes;

        let foundBlock = false;
        let columnBottom = 0, columnTop = 0;
        for (let y1 = 0; y1 < height; y1++) {
            const curBlock = uint8View[blockCoord + OFFSET_SOURCE];
            if ((curBlock & MASK_SRC_REST) > 0) {
                columnTop = 0;
                foundBlock = true;
            } else {
                if (!foundBlock) {
                    columnBottom++;
                }
                columnTop++;
            }
            blockCoord += cy * strideBytes;
        }
        if (nibbles[nibCoord + OFFSET_COLUMN_BOTTOM] === columnBottom
            && nibbles[nibCoord + OFFSET_COLUMN_TOP] === columnTop
            && !force) {
            return;
        }
        force = true;
        nibbles[nibCoord + OFFSET_COLUMN_BOTTOM] = columnBottom;
        nibbles[nibCoord + OFFSET_COLUMN_TOP] = columnTop;

        // we handle PORTALS because FORCE=true
        this.waves.push(lvl, chunk.dataIdShift + nibCoord / nibbleStrideBytes + (force ? MASK_QUEUE_FORCE : 0));
        chunk.waveCounter++;
    }

    doIter(times) {
        const {waves, qOffset, disperse, world} = this;
        const {chunkById} = world.chunkManager;
        const defLight = world.defDayLight;
        //TODO: recover nextWave
        //let nextWave = null;
        let chunk = null;

        let lightChunk = null;
        let uint8View = null;
        let outerSize = null;
        let strideBytes = 0;
        let aabb = 0;
        let outerAABB = null;
        let safeAABB = null;
        let portals = null;
        let dif26 = null;
        let chunkDataId = 0;
        let cx = 0, cy = 0, cz = 0;
        let nibDim = 0;
        let nibbles = null;
        let nibStride = 0;

        let curWave = null;
        for (let tries = 0; tries < times; tries++) {
            curWave = waves.peekNonEmpty();
            if (!curWave) {
                return true;
            }

            let nibCoord = curWave.shift();
            const force = nibCoord & MASK_QUEUE_FORCE;
            nibCoord = nibCoord & ~MASK_QUEUE_FORCE;
            const newChunk = chunkById[nibCoord >> BITS_QUEUE_BLOCK_INDEX];
            nibCoord = nibCoord & MASK_QUEUE_BLOCK_INDEX;
            if (!newChunk || newChunk.removed) {
                continue;
            }
            if (chunk !== newChunk) {
                chunk = newChunk;
                lightChunk = chunk.lightChunk;

                if (!lightChunk.nibbleDims) {
                    // dayLight somehow goes under y<0 limit, where it shouldn't.
                    // probably chunk ID conflict
                    continue;
                }

                uint8View = lightChunk.uint8View;
                outerSize = lightChunk.outerSize;
                strideBytes = lightChunk.strideBytes;
                aabb = lightChunk.aabb;
                outerAABB = lightChunk.outerAABB;
                safeAABB = lightChunk.safeAABB;
                portals = lightChunk.facetPortals;
                dif26 = lightChunk.dif26;
                cx = lightChunk.cx;
                cy = lightChunk.cy;
                cz = lightChunk.cz;
                chunkDataId = chunk.dataIdShift;

                nibbles = lightChunk.nibbles;
                nibDim = lightChunk.nibbleDims.y;
                nibStride = lightChunk.nibbleStrideBytes;
            }
            chunk.waveCounter--;

            let tmp = nibCoord;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let nibY = tmp - lightChunk.padding;
            let y = nibY * nibDim;

            x += outerAABB.x_min;
            y += aabb.y_min;
            z += outerAABB.z_min;

            let mask = 0;
            const coordBytes = nibCoord * nibStride;
            const old = nibbles[coordBytes + OFFSET_COLUMN_DAY];
            const column = nibbles[coordBytes + OFFSET_COLUMN_TOP];
            //TODO: use nibDim from up chunk, it can be different
            let val = 0;
            const upBytes = coordBytes + cy * nibStride;
            let upColumn = nibbles[upBytes + OFFSET_COLUMN_BOTTOM];
            const upDay = nibbles[upBytes + OFFSET_COLUMN_DAY];
            if (upColumn >= nibDim && upDay > 0) {
                val = Math.min(column + upDay, 2 * nibDim);
            } else if (disperse > 0) {
                for (let d = 0; d < 4; d++) {
                    const neibCoord = coordBytes + dif26[d] * nibStride;
                    const neibDay = nibbles[neibCoord + OFFSET_COLUMN_DAY];
                    if (neibDay > disperse) {
                        const neibColumn = nibbles[neibCoord + OFFSET_COLUMN_TOP];
                        if (neibDay > neibColumn) {
                            mask |= 1 << d;
                        }
                        const dispColumn = disperse - Math.min(neibDay - neibColumn, upColumn);
                        if (dispColumn < neibColumn && dispColumn < column) {
                            val = Math.max(val, column - Math.max(dispColumn, 0));
                        }
                    }
                }
            }
            if (old === val && !force) {
                continue;
            }
            let changedDisperse = (disperse > 0) && ((val > disperse) || (old > disperse) || force);
            nibbles[coordBytes + OFFSET_COLUMN_DAY] = val;

            let lim = Math.min(aabb.y_min + (nibY + 1) * nibDim, aabb.y_max);
            let coord = nibCoord + (nibY * nibDim - nibY) * cy;
            for (let y1 = y; y1 < lim; y1++) {
                const curLight = uint8View[coord * strideBytes + qOffset];
                const nibColumn = column - (lim - y1);
                const newLight = (nibColumn >= 0 && val > nibColumn) ? defLight : 0;
                if ((newLight !== defLight) ^ (curLight !== defLight)) {
                    // world.dayLight.add(chunk, coord, Math.max(newLight, curLight), world.getPotential(x, y, z));
                    world.dayLight.addNow(chunk, coord, x, y1, z, newLight);
                }
                coord += cy;
            }
            //TODO: copy to neib chunks
            if (safeAABB.containsColumn(x, z, y, lim)) {
                // super fast case - we are inside data chunk
                waves.push(y - nibDim, chunkDataId + nibCoord - cy);
                chunk.waveCounter++;
                if (changedDisperse) {
                    for (let d = 0; d < 4; d++) {
                        if ((mask & (1 << d)) !== 0) {
                            continue;
                        }
                        curWave.push(chunkDataId + nibCoord + dif26[d]);
                        chunk.waveCounter++;
                    }
                }
            } else {
                for (let p = 0; p < portals.length; p++) {
                    const chunk2 = portals[p].toRegion;
                    if (!(portals[p].aabb.intersectsColumn(x, z, y, lim)) || !portals[p].nibbleCompatible) {
                        continue;
                    }
                    const dif26_ = chunk2.dif26;
                    const cx2 = chunk2.cx, cy2 = chunk2.cy, cz2 = chunk2.cz, shift2 = chunk2.shiftCoord;
                    const nibbles2 = chunk2.nibbles;
                    const nibDim2 = chunk2.nibbleDims.y;
                    const nibStride2 = chunk2.nibbleStrideBytes;
                    const nibY = Math.floor((y - chunk2.aabb.y_min) / nibDim2);
                    const nibCoord2 = cx2 * x + cz2 * z + shift2 + cy2 * (nibY + chunk2.aabb.y_min);
                    nibbles2[nibCoord2 * nibStride2 + OFFSET_COLUMN_DAY] = val;
                    nibbles2[nibCoord2 * nibStride2 + OFFSET_COLUMN_TOP] = column;
                    nibbles2[nibCoord2 * nibStride2 + OFFSET_COLUMN_BOTTOM] = nibbles[coordBytes + OFFSET_COLUMN_BOTTOM];
                    let x2 = x,
                        y2 = y - nibDim,
                        z2 = z;
                    const dataIdShift2 = chunk2.rev.dataIdShift;
                    if (chunk2.aabb.intersectsColumn(x2, z2, y2, y)) {
                        mask |= (1 << DIR_DOWN);
                        waves.push(y - 1, dataIdShift2 + nibCoord2 - cy);
                        chunk2.rev.waveCounter++;
                    }
                    if (changedDisperse) {
                        for (let d = 0; d < 4; d++) {
                            if ((mask & (1 << d)) !== 0) {
                                continue;
                            }
                            x2 = x + dx[d];
                            z2 = z + dz[d];
                            if (chunk2.aabb.intersectsColumn(x2, z2, y, lim)) {
                                mask |= 1 << d;
                                curWave.push(dataIdShift2 + nibCoord2 + dif26_[d]);
                                chunk2.rev.waveCounter++;
                            }
                        }
                    }
                }
                if ((mask & (1 << DIR_DOWN)) === 0) {
                    if (y > aabb.y_min) {
                        waves.push(y - nibDim, chunkDataId + nibCoord - cy);
                        chunk.waveCounter++;
                    }
                }
                if (changedDisperse) {
                    for (let d = 0; d < 4; d++) {
                        if ((mask & (1 << d)) !== 0) {
                            continue;
                        }
                        if (aabb.contains(x + dx[d], y, z + dz[d])) {
                            curWave.push(chunkDataId + nibCoord + dif26[d]);
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
        const {disperse} = this;
        const {lightChunk} = chunk;
        const {aabb, uint8View, strideBytes} = lightChunk;
        const {shiftCoord, cx, cy, cz, dif26} = lightChunk;
        const {nibbles, nibbleDims, nibbleSize, nibbleStrideBytes} = lightChunk;
        const {portals, facetPortals} = lightChunk;
        const {defDayLight} = this.world;

        let nibDim = nibbleDims.y;
        let nibHeight = nibbleSize.y;
        // calculate all columns
        // vertical columns
        for (let colNum = 0; colNum < nibHeight; colNum++) {
            const start = aabb.y_min + colNum * nibDim;
            const lim = Math.min(aabb.y_min + (colNum + 1) * nibDim, aabb.y_max);

            for (let z = aabb.z_min; z < aabb.z_max; z++) {
                for (let x = aabb.x_min; x < aabb.x_max; x++) {
                    const baseXZ = cx * x + cz * z + shiftCoord;
                    let foundBlock = false;
                    let columnBottom = 0, columnTop = 0;
                    for (let y1 = start; y1 < lim; y1++) {
                        const curBlock = uint8View[(baseXZ + cy * y1) * strideBytes + OFFSET_SOURCE];
                        if ((curBlock & MASK_SRC_REST) > 0) {
                            columnTop = 0;
                            foundBlock = true;
                        } else {
                            if (!foundBlock) {
                                columnBottom++;
                            }
                            columnTop++;
                        }
                    }
                    nibbles[(baseXZ + cy * (colNum + aabb.y_min)) * nibbleStrideBytes + OFFSET_COLUMN_BOTTOM] = columnBottom;
                    nibbles[(baseXZ + cy * (colNum + aabb.y_min)) * nibbleStrideBytes + OFFSET_COLUMN_TOP] = columnTop;
                }
            }
        }

        // default light from ABOVE
        for (let z = aabb.z_min; z < aabb.z_max; z++)
            for (let x = aabb.x_min; x < aabb.x_max; x++) {
                let coord = x * cx + z * cz + shiftCoord + cy * (aabb.y_min + nibHeight);
                nibbles[coord * nibbleStrideBytes + OFFSET_COLUMN_DAY] = 2 * nibDim;
                nibbles[coord * nibbleStrideBytes + OFFSET_COLUMN_BOTTOM] = nibDim;
            }
        // ABOVE chunks
        for (let i = 0; i < facetPortals.length; i++) {
            const portal = facetPortals[i];
            const other = portal.toRegion;
            const p = portal.aabb;
            const aabb2 = other.aabb;

            if (!portal.nibbleCompatible || aabb2.y_min <= aabb.y_min) {
                continue;
            }
            const nibbles2 = other.nibbles;
            const cy2 = other.cy, cx2 = other.cx, cz2 = other.cz, shift2 = other.shiftCoord;
            const start1 = Math.floor((p.y_min - aabb.y_min) / nibDim),
                finish1 = Math.floor((p.y_max - 1 - aabb.y_min) / nibDim) + 1;
            for (let y1 = start1; y1 < finish1; y1++) {
                const y1_ = y1 + aabb.y_min;
                let y = y1 * nibDim + aabb.y_min;
                const y2_ = Math.floor((y - aabb2.y_min) / nibDim) + aabb2.y_min;
                for (let z = p.z_min; z < p.z_max; z++)
                    for (let x = p.x_min; x < p.x_max; x++) {
                        const coord1 = (cx * x + cy * y1_ + cz * z + shiftCoord) * nibbleStrideBytes;
                        const coord2 = (cx2 * x + cy2 * y2_ + cz2 * z + shift2) * nibbleStrideBytes;
                        const f1 = aabb.contains(x, y, z);
                        const f2 = aabb2.contains(x, y, z);
                        if (f2 && !f1) {
                            nibbles[coord1 + OFFSET_COLUMN_DAY] = nibbles2[coord2 + OFFSET_COLUMN_DAY];
                            nibbles[coord1 + OFFSET_COLUMN_BOTTOM] = nibbles2[coord2 + OFFSET_COLUMN_BOTTOM];
                            nibbles[coord1 + OFFSET_COLUMN_TOP] = nibbles2[coord2 + OFFSET_COLUMN_TOP];
                        }
                    }
            }
        }
        // Trivial fill inside
        let foundShadow = false;
        for (let z = aabb.z_min; z < aabb.z_max; z++)
            for (let x = aabb.x_min; x < aabb.x_max; x++) {
                let coord = x * cx + z * cz + shiftCoord + cy * (aabb.y_min + nibHeight);
                let top = nibbles[coord * nibbleStrideBytes + OFFSET_COLUMN_BOTTOM] >= nibDim
                    ? nibbles[coord * nibbleStrideBytes + OFFSET_COLUMN_DAY] : 0;
                for (let y = nibHeight - 1; y >= 0 && top > 0; y--) {
                    coord -= cy;
                    const column = nibbles[coord * nibbleStrideBytes + OFFSET_COLUMN_TOP];
                    top = Math.min(top + column, 2 * nibDim);
                    nibbles[coord * nibbleStrideBytes + OFFSET_COLUMN_DAY] = top;
                    let coord0 = x * cx + z * cz + (aabb.y_min + (y + 1) * nibDim) * cy + shiftCoord;
                    for (let y0 = 0; y0 < column; y0++) {
                        coord0 -= cy;
                        uint8View[coord0 * strideBytes + OFFSET_DAY] = defDayLight;
                    }
                    if (column < nibDim) {
                        top = 0;
                        break;
                    }
                }
                if (top === 0) {
                    foundShadow = true;
                }
            }
        if (foundShadow) {
            chunk.lastID++;
        }
        // Handle portals, just copy
        // 3. pass through portals
        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            const other = portal.toRegion;
            const p = portal.aabb;
            const aabb2 = other.aabb;
            const cy2 = other.cy, cx2 = other.cx, cz2 = other.cz, shift2 = other.shiftCoord;
            const bytes2 = other.uint8View;
            // 3.1 pass light values
            let invalidateOther = false;
            for (let y = p.y_min; y < p.y_max; y++)
                for (let z = p.z_min; z < p.z_max; z++)
                    for (let x = p.x_min; x < p.x_max; x++) {
                        const coord1 = (cx * x + cy * y + cz * z + shiftCoord) * strideBytes;
                        const coord2 = (cx2 * x + cy2 * y + cz2 * z + shift2) * strideBytes;
                        const f1 = aabb.contains(x, y, z);
                        const f2 = aabb2.contains(x, y, z);
                        if (f1) {
                            const light = uint8View[coord1 + OFFSET_DAY];
                            const oldCopy = bytes2[coord2 + OFFSET_DAY] ;
                            if (oldCopy > 0 && oldCopy !== light) {
                                invalidateOther = true;
                            }
                            bytes2[coord2 + OFFSET_DAY] = light;
                        }
                        if (f2) {
                            const srcBlock = (bytes2[coord2 + OFFSET_SOURCE] & MASK_SRC_BLOCK) === MASK_SRC_BLOCK;
                            const light = bytes2[coord2 + OFFSET_DAY];
                            uint8View[coord1 + OFFSET_DAY] = light;

                            if (portal.isFacet && light < defDayLight && (!srcBlock || !invalidateOther)) {
                                // check neibs, add this point to QUEUE or invalidate chunk if corresponding point in chunk is lighted
                                for (let dir = 0; dir < 6; dir++) {
                                    let x2 = x + dx[dir], y2 = y + dy[dir], z2 = z + dz[dir];
                                    if (aabb.contains(x2, y2, z2)
                                        && uint8View[coord1 + dif26[dir] * strideBytes + OFFSET_DAY] > light) {
                                        if (srcBlock) {
                                            invalidateOther = true;
                                        } else {
                                            this.world.dayLight.add(other.rev, coord2 / strideBytes,
                                                defDayLight, this.world.getPotential(x, y, z));
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
            if (invalidateOther) {
                other.rev.lastID++;
            }
            if (!portal.isFacet || !portal.nibbleCompatible) {
                continue;
            }

            const nibbles2 = other.nibbles;
            // 3.2 pass nibbles
            const start1 = Math.floor((p.y_min - aabb.y_min) / nibDim),
                finish1 = Math.floor((p.y_max - 1 - aabb.y_min) / nibDim) + 1;
            for (let y1 = start1; y1 < finish1; y1++) {
                const y1_ = y1 + aabb.y_min;
                let y = y1 * nibDim + aabb.y_min;
                const y2_ = Math.floor((y - aabb2.y_min) / nibDim) + aabb2.y_min;
                for (let z = p.z_min; z < p.z_max; z++)
                    for (let x = p.x_min; x < p.x_max; x++) {
                        const coord1 = (cx * x + cy * y1_ + cz * z + shiftCoord) * nibbleStrideBytes;
                        const coord2 = (cx2 * x + cy2 * y2_ + cz2 * z + shift2) * nibbleStrideBytes;
                        const f1 = aabb.contains(x, y, z);
                        const f2 = aabb2.contains(x, y, z);
                        if (f1) {
                            nibbles2[coord2 + OFFSET_COLUMN_DAY] = nibbles[coord1 + OFFSET_COLUMN_DAY];
                            nibbles2[coord2 + OFFSET_COLUMN_BOTTOM] = nibbles[coord1 + OFFSET_COLUMN_BOTTOM];
                            nibbles2[coord2 + OFFSET_COLUMN_TOP] = nibbles[coord1 + OFFSET_COLUMN_TOP];
                        }
                        if (f2) {
                            const day = nibbles2[coord2 + OFFSET_COLUMN_DAY];
                            const column = nibbles2[coord2 + OFFSET_COLUMN_TOP];
                            nibbles[coord1 + OFFSET_COLUMN_DAY] = day;
                            nibbles[coord1 + OFFSET_COLUMN_TOP] = column;
                            nibbles[coord1 + OFFSET_COLUMN_BOTTOM] = nibbles2[coord2 + OFFSET_COLUMN_BOTTOM];

                            let foundImprovement = false;

                            if (aabb.contains(x, y + nibDim, z)) {
                                const upDay = nibbles[coord1 + cy * nibbleStrideBytes + OFFSET_COLUMN_BOTTOM] >= nibDim
                                    ? nibbles[coord1 + cy * nibbleStrideBytes + OFFSET_COLUMN_DAY] : 0;
                                if (day < nibDim * 2 && upDay >= nibDim) {
                                    foundImprovement = true;
                                }
                                if (day >= nibDim && upDay < nibDim) {
                                    foundImprovement = true;
                                }
                            } else if (disperse > 0) {
                                //TODO: something fishy here
                                if (day < nibDim) {
                                    // check neibs, add this point to QUEUE or invalidate chunk if corresponding point in chunk is lighted
                                    for (let dir = 0; dir < 4; dir++) {
                                        let x2 = x + dx[dir], z2 = z + dz[dir];
                                        if (aabb.contains(x2, y, z2)
                                            && nibbles[coord1 + dif26[dir] * nibbleStrideBytes + OFFSET_COLUMN_DAY] > disperse) {
                                            foundImprovement = true;
                                            break;
                                        }
                                    }
                                } else if (day > disperse) {
                                    for (let dir = 0; dir < 4; dir++) {
                                        let x2 = x + dx[dir], z2 = z + dz[dir];
                                        const coord2 = coord1 + dif26[dir] * nibbleStrideBytes;
                                        if (aabb.contains(x2, y, z2)
                                            && nibbles[coord2 + OFFSET_COLUMN_DAY] === 0
                                            && nibbles[coord2 + OFFSET_COLUMN_TOP] >= nibDim) {
                                            foundImprovement = true;
                                            break;
                                        }
                                    }
                                }
                            }

                            if (foundImprovement) {
                                this.addDirect(other.rev, coord2 / nibbleStrideBytes);
                            }
                        }
                    }
            }
        }
        // add to queue CUBE neibs that can be improved
        if (!foundShadow) {
            return;
        }
        for (let y = aabb.y_min; y < aabb.y_max; y++)
            for (let z = aabb.z_min; z < aabb.z_max; z++)
                for (let x = aabb.x_min; x < aabb.x_max; x++) {
                    const coord = cx * x + cy * y + cz * z + shiftCoord;
                    if ((uint8View[coord * strideBytes + OFFSET_SOURCE] & MASK_SRC_BLOCK) === MASK_SRC_BLOCK) {
                        continue;
                    }
                    const light = uint8View[coord * strideBytes + OFFSET_DAY];
                    if (light >= defDayLight) {
                        continue;
                    }
                    // here, light should be 0
                    let neibLight = 0;
                    for (let dir = 0; dir < 6; dir++) {
                        neibLight = Math.max(neibLight, uint8View[(coord + dif26[dir]) * strideBytes + OFFSET_DAY]);
                        if (neibLight >= defDayLight) {
                            break;
                        }
                    }
                    if (neibLight > light) {
                        this.world.dayLight.add(chunk, coord, neibLight, this.world.getPotential(x, y, z));
                    }
                }
        // add to queue NIBBLE neibs that have lighted neighbours
        for (let nibY = 0; nibY < nibHeight; nibY++) {
            for (let z = aabb.z_min; z < aabb.z_max; z++)
                for (let x = aabb.x_min; x < aabb.x_max; x++) {
                    const nibCoord = cx * x + cy * (nibY + aabb.y_min) + cz * z + shiftCoord;
                    if (nibbles[nibCoord * nibbleStrideBytes + OFFSET_COLUMN_DAY] > 0) {
                        continue;
                    }
                    for (let dir = 0; dir < 4; dir++) {
                        if (nibbles[(nibCoord + dif26[dir]) * nibbleStrideBytes + OFFSET_COLUMN_DAY] > 0) {
                            this.addDirect(chunk, nibCoord);
                            break;
                        }
                    }
                }
        }
    }
}
