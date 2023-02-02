import {Vector} from '../helpers.js';
import {
    adjustLight,
    adjustSrc,
    BITS_QUEUE_BLOCK_INDEX,
    DIR_COUNT,
    DISPERSE_MIN, dx, dy, dz, LIGHT_STRIDE_BYTES, LIGHT_STRIDE_BYTES_NORMAL, MASK_SRC_AMOUNT, MASK_SRC_AO,
    MASK_SRC_BLOCK, OFFSET_DAY, OFFSET_LIGHT, OFFSET_NORMAL,
    OFFSET_SOURCE
} from "./LightConst.js";
import {DataChunk} from "../core/DataChunk.js";
import {ChunkGroundLevel} from "./GroundLevel.js"

function calcDif26(size, out) {
    //TODO: move to BaseChunk
    const sx = 1, sz = size.x, sy = size.x * size.z;
    for (let i = 0; i < DIR_COUNT; i++) {
        out.push(sx * dx[i] + sy * dy[i] + sz * dz[i]);
    }
}

export class Chunk {
    constructor(world, args) {
        this.world = world;
        this.dataId = args.dataId;
        this.dataIdShift = args.dataId << BITS_QUEUE_BLOCK_INDEX;
        this.addr = new Vector(args.addr.x, args.addr.y, args.addr.z);
        this.size = new Vector(args.size.x, args.size.y, args.size.z);
        this.uniqId = args.uniqId;
        this.lastID = 0;
        this.sentID = 0;
        this.removed = false;
        this.waveCounter = 0;
        this.crc = 0;

        this.disperse = this.addr.y >= 0 ? DISPERSE_MIN + 1 : 0;

        this.lightChunk = new DataChunk({
            size: args.size,
            strideBytes: this.world.light.offsetNormal > 0 ? LIGHT_STRIDE_BYTES_NORMAL: LIGHT_STRIDE_BYTES,
            nibble: this.disperse > 0 ? {
                dims: new Vector(1, this.disperse, 1),
                strideBytes: 3,
            }: null
        }).setPos(new Vector().copyFrom(args.addr).mul(args.size));
        this.pos = this.lightChunk.pos;

        calcDif26(this.lightChunk.outerSize, this.lightChunk.dif26);

        this.lightChunk.rev = this;
        if (args.light_buffer) {
            this.setLightFromBuffer(args.light_buffer);
        }

        this.outerSize = this.lightChunk.outerSize;
        this.len = this.lightChunk.insideLen;
        this.outerLen = this.lightChunk.outerLen;

        this.groundLevel = new ChunkGroundLevel(this);
    }

    get chunkManager() {
        return this.world.chunkManager;
    }

    setLightFromBuffer(buf) {
        const {uint8View, padding, size, outerSize, strideBytes} = this.lightChunk;
        const src = new Uint8Array(buf);
        for (let y = 0; y < size.y; y++) {
            for (let z = 0; z < size.z; z++) {
                const indFrom = (y * size.z + z) * size.x;
                let indTo = (((y + padding) * outerSize.z + (z + padding)) * outerSize.x + padding) * strideBytes;
                for (let x = 0; x < size.x; x++) {
                    uint8View[indTo + OFFSET_SOURCE] = adjustSrc(src[indFrom + x]);
                    indTo += strideBytes;
                }
            }
        }
    }

    init() {
        this.resultLen = this.outerLen;
        this.lightResult = null;
    }

    fillOuter() {
        //checks neighbour chunks
        const {lightChunk, world} = this;
        const {portals, aabb, uint8View, strideBytes, dif26, dataView} = lightChunk;
        const {offsetNormal} = world.light;
        const {shiftCoord, cx, cy, cz} = lightChunk;
        let found = false;

        if (lightChunk.pos.y >= 0) {
            world.dayLightSrc.fillOuter(this);
        }

        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            const other = portal.toRegion;
            const p = portal.aabb;
            const inside2 = other.aabb;
            const bytes2 = other.uint8View;
            const dataView2 = other.dataView;
            const cy2 = other.cy, cx2 = other.cx, cz2 = other.cz, shift2 = other.shiftCoord;

            for (let x = p.x_min; x < p.x_max; x++)
                for (let y = p.y_min; y < p.y_max; y++)
                    for (let z = p.z_min; z < p.z_max; z++) {
                        const coord1 = (cx * x + cy * y + cz * z + shiftCoord) * strideBytes;
                        const coord2 = (cx2 * x + cy2 * y + cz2 * z + shift2) * strideBytes;
                        //TODO: optimize contains here?
                        const f1 = aabb.contains(x, y, z);
                        const f2 = inside2.contains(x, y, z);
                        // copy light
                        const light = bytes2[coord2 + OFFSET_LIGHT];
                        if (light > 0) {
                            uint8View[coord1 + OFFSET_LIGHT] = light;
                            if (offsetNormal > 0) {
                                // we ignore ending here because its set/get
                                dataView.setUint32(coord1 + offsetNormal,
                                    dataView2.getUint32(coord2 + offsetNormal));
                            }
                        }

                        // copy AO through border
                        if (f1) {
                            if ((bytes2[coord2 + OFFSET_SOURCE] & MASK_SRC_AO) !== (uint8View[coord1 + OFFSET_SOURCE] & MASK_SRC_AO)) {
                                other.rev.lastID++;
                            }
                            bytes2[coord2 + OFFSET_SOURCE] = uint8View[coord1 + OFFSET_SOURCE]
                        }
                        if (f2) {
                            if ((uint8View[coord1 + OFFSET_SOURCE] & MASK_SRC_AO) !== (bytes2[coord2 + OFFSET_SOURCE] & MASK_SRC_AO)) {
                                found = true;
                            }
                            uint8View[coord1 + OFFSET_SOURCE] = bytes2[coord2 + OFFSET_SOURCE]
                        }
                    }
        }
        // add light to queue
        for (let y = aabb.y_min; y < aabb.y_max; y++)
            for (let z = aabb.z_min; z < aabb.z_max; z++)
                for (let x = aabb.x_min; x < aabb.x_max; x++) {
                    const coord = x * cx + y * cy + z * cz + shiftCoord, coordBytes = coord * strideBytes;
                    // just in case chunk is reloaded, need to check past
                    let m = 0;
                    const past = uint8View[coordBytes + OFFSET_LIGHT];
                    const isBlock = (uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_BLOCK) === MASK_SRC_BLOCK;
                    if (!isBlock) {
                        //TODO: check if its water or something advanced blocking light
                        for (let d = 0; d < 6; d++) {
                            m = Math.max(m, uint8View[(coord + dif26[d]) * strideBytes + OFFSET_LIGHT]);
                        }
                        m = Math.max(m, past);
                        m = Math.max(m, uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_AMOUNT);
                    }
                    if (m > 0 || past > 0) {
                        world.light.add(this, coord, m, world.getPotential(x, y, z));
                    }
                    found = found || (uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_AO) > 0;
                }
        if (found) {
            this.lastID++;
        }
    }

    calcResult(is4444, hasNormals) {
        const {lightChunk} = this;
        const {outerSize, uint8View, strideBytes} = lightChunk;
        const elemPerBlock = is4444 ? 1 : 4;
        const depthMul = hasNormals ? 2 : 1;
        if (!this.lightResult) {
            if (is4444) {
                this.lightResult = new Uint16Array(this.resultLen * elemPerBlock * depthMul);
            } else {
                this.lightResult = new Uint8Array(this.resultLen * elemPerBlock * depthMul);
            }
        }

        const result = this.lightResult;
        const sy = outerSize.x * outerSize.z * strideBytes, sx = strideBytes, sz = outerSize.x * strideBytes;

        //TODO: separate multiple cycle

        // Light + AO
        let changed = false;
        let changedDay = false;
        let pv1, pv2, pv3, pv4, pv5, pv6, pv7, pv8;
        let ind = 0, ind2 = lightChunk.outerLen * elemPerBlock;

        this.result_crc_sum = 0;

        //
        const addResult1 = (R, G, B, A) => {
            if (is4444) {
                const prev_value = result[ind];
                const new_value = (Math.round(R) << 12)
                    + (Math.round(15.0 - G) << 8)
                    + (Math.round(B * 15.0) << 4)
                    + (Math.round(A * 0.5 * 15.0) << 0);
                result[ind++] = new_value;
                if (prev_value != new_value) {
                    changed = true;

                }
                if ((prev_value & 0xf00) !== (new_value & 0xf00)) {
                    changedDay = true;
                }
                this.result_crc_sum += new_value;
            } else {
                if (!changed) {
                    pv1 = result[ind + 0];
                    pv2 = result[ind + 1];
                    pv3 = result[ind + 2];
                    pv4 = result[ind + 3];
                }
                result[ind++] = Math.round(R * 255.0 / 15.0);
                result[ind++] = Math.round(255.0 - (G * 255.0 / 15.0));
                result[ind++] = Math.round(B * 255.0);
                result[ind++] = Math.round(A * 0.5 * 255.0);
                if (!changed) {
                    if (pv1 != result[ind - 4] || pv2 != result[ind - 3] || pv3 != result[ind - 2] || pv4 != result[ind - 1]) {
                        changed = true;
                    }

                }
                changedDay = changedDay || pv2 !== result[ind - 3];
                this.result_crc_sum += (
                    result[ind - 4] +
                    result[ind - 3] +
                    result[ind - 2] +
                    result[ind - 1]
                );
            }
        };

        for (let y = 0; y < outerSize.y; y++)
            for (let z = 0; z < outerSize.z; z++)
                for (let x = 0; x < outerSize.x; x++) {
                    const coord0 = sx * x + sy * y + sz * z;

                    const block = (uint8View[coord0 + OFFSET_SOURCE] & MASK_SRC_BLOCK) === MASK_SRC_BLOCK ? 1: 0;
                    const ao = (uint8View[coord0 + OFFSET_SOURCE] & MASK_SRC_AO) > 0 ? 1 : 0;

                    addResult1(adjustLight(uint8View[coord0 + OFFSET_LIGHT]),
                        adjustLight(uint8View[coord0 + OFFSET_DAY]),
                        block,
                        ao + block);
                }

        const addResult2 = (R, G, B, A) => {
            if (!changed) {
                pv1 = result[ind + 0];
                pv2 = result[ind + 1];
                pv3 = result[ind + 2];
                pv4 = result[ind + 3];
            }
            result[ind++] = R;
            result[ind++] = G;
            result[ind++] = B;
            result[ind++] = Math.round(A * 255.0);
            if (!changed) {
                if (pv1 != result[ind - 4] || pv2 != result[ind - 3] || pv3 != result[ind - 2] || pv4 != result[ind - 1]) {
                    changed = true;
                }
            }
            changedDay = changedDay || pv2 !== result[ind - 3];
            this.result_crc_sum += (
                result[ind - 4] +
                result[ind - 3] +
                result[ind - 2] +
                result[ind - 1]
            );
        };

        if (hasNormals) {
            const dataView = lightChunk.dataView;
            for (let y = 0; y < outerSize.y; y++)
                for (let z = 0; z < outerSize.z; z++)
                    for (let x = 0; x < outerSize.x; x++) {
                        const coord0 = sx * x + sy * y + sz * z;
                        let dx = uint8View[coord0 + OFFSET_NORMAL];
                        let dz = uint8View[coord0 + OFFSET_NORMAL + 1];
                        let dy = uint8View[coord0 + OFFSET_NORMAL + 2];
                        let light = uint8View[coord0 + OFFSET_LIGHT] > 0 ? 1 : 0;
                        addResult2(light * dx, light * dz, light * dy, light);
                    }
        }

        //
        if (changed) {
            this.crc++;
        } else {
            // TODO: find out why are there so many calcResults
            // console.log('WTF');
        }
        if (changedDay) {
            this.groundLevel.calcMinLightY(is4444);
        }
    }
}
