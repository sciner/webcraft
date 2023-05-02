import {Vector} from '../helpers.js';
import {
    adjustSrc,
    BITS_QUEUE_BLOCK_INDEX,
    DIR_COUNT,
    DISPERSE_MIN, dx, dy, dz, LIGHT_STRIDE_BYTES, LIGHT_STRIDE_BYTES_NORMAL, MASK_SRC_AMOUNT, MASK_SRC_AO,
    MASK_SRC_BLOCK, OFFSET_DAY, OFFSET_LIGHT,
    OFFSET_SOURCE
} from "./LightConst.js";
import {DataChunk} from "../core/DataChunk.js";
import {ChunkGroundLevel} from "./GroundLevel.js"
import {LightCalc} from "./LightCalc.js";

function calcDif26(size, out) {
    //TODO: move to BaseChunk
    const sx = 1, sz = size.x, sy = size.x * size.z;
    for (let i = 0; i < DIR_COUNT; i++) {
        out.push(sx * dx[i] + sy * dy[i] + sz * dz[i]);
    }
}

export class Chunk {
    [key: string]: any;
    constructor(world, args) {
        this.world = world;
        this.dataId = args.dataId;
        this.dataIdShift = args.dataId << BITS_QUEUE_BLOCK_INDEX;
        this.addr = new Vector(args.addr.x, args.addr.y, args.addr.z);
        //TODO: this is from grid!
        this.size = new Vector(args.size.x, args.size.y, args.size.z);
        this.chunkWave = [null, null, null, null];
        this.uniqId = args.uniqId;
        this.defaultDaylightValue = args.defaultDaylightValue || 15;
        this.lastID = 0;
        this.lastAO = 0;
        this.sentID = 0;
        this.waveCounter = 0;
        this.crc = 0;

        this.disperse = DISPERSE_MIN + 1;
        //TODO: copy default layer light here

        const grid = this.world.chunkManager.lightBase.grid;
        this.lightChunk = new DataChunk({
            grid,
            strideBytes: this.world.light.offsetNormal > 0 ? LIGHT_STRIDE_BYTES_NORMAL: LIGHT_STRIDE_BYTES,
            nibble: this.disperse > 0 ? {
                dims: new Vector(1, this.disperse, 1),
                strideBytes: 3,
            }: null
        }).setPos(grid.chunkAddrToCoord(args.addr));
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

    freeWave(qOffset: number) {
        const arr = this.chunkWave[qOffset];
        if (arr && arr.refCounter === 0) {
            this.world.gridPool.freeUint8(arr);
            this.chunkWave[qOffset] = null;
        }
    }

    checkWave(qOffset: number, coord: number, waveNum: number) {
        const arr = this.chunkWave[qOffset];
        if (arr) {
            if (arr.arr[coord] >= waveNum) {
                return null;
            }
            return arr;
        }
        return this.chunkWave[qOffset] = this.world.gridPool.allocUint8();
    }

    get chunkManager() {
        return this.world.chunkManager;
    }

    setLightFromBuffer(buf) {
        const {uint8View, padding, size, outerSize, outerLen, strideBytes} = this.lightChunk;
        const src = new Uint8Array(buf);


        const ambientLight = this.world.light.ambientLight;
        const ambientDayLight = this.world.light.ambientDayLight;
        for (let y = 0; y < size.y; y++) {
            for (let z = 0; z < size.z; z++) {
                const indFrom = (y * size.z + z) * size.x;
                let indTo = (((y + padding) * outerSize.z + (z + padding)) * outerSize.x + padding) * strideBytes;
                for (let x = 0; x < size.x; x++) {
                    const srcAdj= uint8View[indTo + OFFSET_SOURCE] = adjustSrc(src[indFrom + x]);
                    if ((srcAdj & MASK_SRC_BLOCK) !== MASK_SRC_BLOCK) {
                        uint8View[indTo + OFFSET_LIGHT] = ambientLight;
                        uint8View[indTo + OFFSET_DAY] = ambientDayLight;
                    }
                    indTo += strideBytes;
                }
            }
        }
    }

    init() {
        this.calc = new LightCalc(this);
    }

    fillOuter() {
        //checks neighbour chunks
        const {lightChunk, world} = this;
        const {portals, aabb, uint8View, strideBytes, dif26, dataView} = lightChunk;
        const {offsetNormal} = world.light;
        const {shiftCoord, cx, cy, cz} = lightChunk;
        let found = false;

        world.dayLightSrc.fillOuter(this);

        const ambientLight = world.light.ambientLight;
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
                        if (f2 && light > 0 || f1 && light > ambientLight) {
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
                            bytes2[coord2 + OFFSET_LIGHT] = uint8View[coord1 + OFFSET_LIGHT]
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
                    let m = ambientLight;
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
                    if (m > ambientLight || past > ambientLight) {
                        world.light.add(this, coord, m, world.getPotential(x, y, z));
                    }
                    found = found || (uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_AO) > 0;
                }
        if (found) {
            this.lastID++;
            this.lastAO++;
        }
    }
}
