import {VectorCollector, Vector} from '../helpers.js';
import {BaseChunk} from '../core/BaseChunk.js';
import {
    OFFSET_DAY,
    DEFAULT_LIGHT_DAY_DISPERSE,
    maxPotential,
    dlen,
    adjustSrc,
    OFFSET_LIGHT,
    OFFSET_SOURCE, MASK_SRC_AO, MASK_SRC_REST, maxLight, DISPERSE_MIN
} from "./LightConst.js";
import {LightQueue} from "./LightQueue.js";
import {DirNibbleQueue} from "./DirNibbleQueue.js";

export class ChunkManager {
    constructor(world) {
        this.chunks = new VectorCollector();
        this.list = [];

        this.world = world;
        const INF = 1000000000;
        this.lightBase = new BaseChunk({size: new Vector(INF, INF, INF)}).setPos(new Vector(-INF / 2, -INF / 2, -INF / 2));
        this.chunkById = [null];
        this.activePotentialCenter = null;
        this.nextPotentialCenter = null;
    }

    // Get
    getChunk(addr) {
        return this.chunks.get(addr);
    }

    add(chunk) {
        this.list.push(chunk);
        this.chunks.add(chunk.addr, chunk);
        this.lightBase.addSub(chunk.lightChunk);

        this.chunkById[chunk.dataId] = chunk;
    }

    delete(chunk) {
        if (this.chunks.delete(chunk.addr)) {
            this.chunkById[chunk.dataId] = null;
            this.list.splice(this.list.indexOf(chunk), 1);
            this.lightBase.removeSub(chunk.lightChunk);
        }
    }
}

export class LightWorld {
    constructor() {
        this.chunkManager = new ChunkManager(this);
        this.light = new LightQueue(this, {offset: 0, dirCount: 6});
        this.dayLight = new LightQueue(this,
            {
                offset: OFFSET_DAY - 1,
                dirCount: 6,
                nibbleSource: true,
            });
        //this.dayLight.deque.debugName = 'DayLight';
        this.dayLightSrc = new DirNibbleQueue(this, {
            offset: OFFSET_DAY,
            disperse: DISPERSE_MIN, //DEFAULT_LIGHT_DAY_DISPERSE
        })
        //this.dayLightSrc.waves.debugName = 'DayLightSrc';
        this.defDayLight = adjustSrc(15);
        this.isEmptyQueue = true;
    }

    getPotential(wx, wy, wz) {
        const {activePotentialCenter} = this.chunkManager;
        if (!activePotentialCenter) {
            return 0;
        }
        const dist = (Math.abs(wx - activePotentialCenter.x)
            + Math.abs(wy - activePotentialCenter.y)
            + Math.abs(wz - activePotentialCenter.z)) * dlen[0];
        return maxPotential - Math.min(maxPotential, dist);
    }

    checkPotential() {
        if (this.isEmptyQueue && this.chunkManager.nextPotentialCenter) {
            this.chunkManager.activePotentialCenter = this.chunkManager.nextPotentialCenter;
        }
    }

    setBlock({addr, light_source, x, y, z}) {
        let chunk = this.chunkManager.getChunk(addr);
        if (!chunk) {
            return;
        }
        const {lightChunk} = chunk;
        const {portals, uint8View, strideBytes} = lightChunk;
        const ind = lightChunk.indexByWorld(x, y, z);
        const light = uint8View[ind * strideBytes + OFFSET_LIGHT];
        const src = adjustSrc(light_source);
        const old_src = uint8View[ind * strideBytes + OFFSET_SOURCE];
        uint8View[ind * strideBytes + OFFSET_SOURCE] = src;
        const potential = this.getPotential(x, y, z);
        this.light.add(chunk, ind, Math.max(light, src), potential);
        // push ao
        const setAo = ((src & MASK_SRC_AO) !== (old_src & MASK_SRC_AO));
        //TODO: move it to adjust func
        if ((src & MASK_SRC_REST) !== (old_src & MASK_SRC_REST)) {
            this.dayLightSrc.addWithChange(chunk, ind);
            this.dayLight.add(chunk, ind, this.defDayLight, potential);
        }
        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            if (portal.aabb.contains(x, y, z)) {
                const other = portal.toRegion;
                const ind = other.indexByWorld(x, y, z);
                other.setUint8ByInd(ind, OFFSET_SOURCE, src)
                if (setAo) {
                    other.rev.lastID++;
                }
            }
        }
    }
}
