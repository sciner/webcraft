import {VectorCollector, Vector} from '../helpers.js';
import {BaseChunk} from '../core/BaseChunk.js';
import {
    OFFSET_DAY,
    DEFAULT_LIGHT_DAY_DISPERSE,
    maxPotential,
    dlen,
    adjustSrc,
    OFFSET_LIGHT,
    OFFSET_SOURCE, MASK_SRC_AO, MASK_SRC_REST, maxLight, DISPERSE_MIN, adjustLight
} from "./LightConst.js";
import {LightQueue} from "./LightQueue.js";
import {DirNibbleQueue} from "./DirNibbleQueue.js";
import {WorldGroundLevel} from "./GroundLevel.js"
import {Chunk} from "./Chunk.js";
import {ChunkGrid} from "../core/ChunkGrid.js";

export class LightWorkerChunkManager {
    [key: string]: any;

    constructor(world) {
        this.chunks = new VectorCollector();
        this.list = [];

        this.world = world;
        const INF = 1000000000;
        this.lightBase = new BaseChunk({grid: new ChunkGrid({}), size: new Vector(INF, INF, INF)})
            .setPos(new Vector(-INF / 2, -INF / 2, -INF / 2));
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
        //TODO: use chunks in grid instead
        this.chunks.add(chunk.addr, chunk);
        this.lightBase.addSub(chunk.lightChunk);

        this.chunkById[chunk.dataId] = chunk;

        this.world.groundLevel.onAddChunk(chunk);
    }

    delete(chunk) {
        if (this.chunks.delete(chunk.addr)) {
            this.wasDelete = true;
            this.chunkById[chunk.dataId] = null;
            this.lightBase.removeSub(chunk.lightChunk);
            this.world.groundLevel.onDeleteChunk(chunk);
        }
    }

    wasDelete = false;
    deleteMultiple(dataChunks) {
        this.lightBase.grid.removeMultiple(dataChunks, (dataChunk) => {
            const chunk = dataChunk.rev;
            chunk.removed = true;
            this.world.groundLevel.onDeleteChunk(chunk);
            if (!this.chunks.delete(chunk.addr)) {
                console.log("Light worker double-delete same chunk");
            }
        })
        this.wasDelete = true;
    }

    getList() {
        const {list} = this;
        if (!this.wasDelete) {
            return list;
        }
        this.wasDelete = false;
        let j = 0;
        for (let i=0;i<list.length;i++) {
            if (list[i].removed) {
            } else {
                list[j++] = list[i];
            }
        }
        list.length = j;
        return list;
    }
}

export class LightWorld {
    [key: string]: any;
    constructor(worker, worldId) {
        this.chunkManager = new LightWorkerChunkManager(this);
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

        this.groundLevel = new WorldGroundLevel(this);

        this.renderOptions = {
            hasNormals: false,
            hasTexture: false,
        }

        this.worker = worker;
        this.worldId = worldId;

        this.curChunkIndex = 0;
    }

    setRenderOptions(args) {
        this.renderOptions.hasTexture = args.hasTexture;
        this.renderOptions.hasNormals = !!args.hasNormals;
        this.light.setNormals(this.renderOptions.hasNormals);
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
        this.groundLevel.onCheckPotential();
    }

    postMessage(msg, transfer?) {
        msg.unshift(this.worldId);
        this.worker.postMessage(msg, transfer);
    }

    setChunkBlock({addr, list}) {
        let chunk = this.chunkManager.getChunk(addr);
        if (!chunk) {
            return;
        }
        const {lightChunk} = chunk;
        const {portals, uint8View, strideBytes} = lightChunk;
        for (let j = 0; j < list.length; j += 4) {
            const x = list[j] + lightChunk.pos.x;
            const y = list[j + 1] + lightChunk.pos.y;
            const z = list[j + 2] + lightChunk.pos.z;
            const light_source = list[j + 3];
            const ind = lightChunk.indexByWorld(x, y, z);
            const light = uint8View[ind * strideBytes + OFFSET_LIGHT];
            const src = adjustSrc(light_source);
            const old_src = uint8View[ind * strideBytes + OFFSET_SOURCE];
            uint8View[ind * strideBytes + OFFSET_SOURCE] = src;
            const potential = this.getPotential(x, y, z);
            this.light.add(chunk, ind, Math.max(light, src), potential);
            // push ao
            const setAo = ((src & MASK_SRC_AO) !== (old_src & MASK_SRC_AO));
            if (setAo) {
                chunk.lastAO++;
            }
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
                        other.rev.lastAO++;
                    }
                }
            }
        }
    }

    process({maxMs = 16}) {
        const msLimit = maxMs;
        const resultLimit = 5;
        const startTime = performance.now();
        let endTime = performance.now();
        let endChunks = 0;
        let ready;
        do {
            ready = 3;
            if (this.light.doIter(10000)) {
                ready--;
            }
            endTime = performance.now();
            // if (endTime > startTime + msLimit) {
            //     break;
            // }
            if (this.dayLightSrc.doIter(40000)) {
                ready--;
            }
            // if (endTime > startTime + msLimit) {
            //     break;
            // }
            endTime = performance.now();
            if (this.dayLight.doIter(20000)) {
                ready--;
            }
            endTime = performance.now();
        } while (endTime < startTime + msLimit && ready > 0);
        // if (endTime - startTime > 0.3) {
        //     console.log(`Light took ${endTime - startTime}`);
        // }

        this.isEmptyQueue = ready === 0;
        this.checkPotential();

        let {curChunkIndex} = this;
        const chunkList = this.chunkManager.list;

        const {hasTexture, hasNormals} = this.renderOptions;
        let dayChanged = false;
        for (let loop = chunkList.length - 1; loop >= 0; loop--) {
            curChunkIndex = (curChunkIndex + 1) % chunkList.length;

            const chunk = chunkList[curChunkIndex];
            if (chunk.waveCounter !== 0)
                continue;
            chunk.calc.checkAll(hasTexture, hasNormals);
            if (hasTexture) {
                if (chunk.sentID !== chunk.calc.texID) {
                    chunk.sentID = chunk.calc.texID;
                    this.postMessage(['light_generated', {
                        addr: chunk.addr,
                        lightData: chunk.calc.lightData,
                        lightTexData: chunk.calc.lightTexData,
                        lightID: chunk.sentID,
                        uniqId: chunk.uniqId,
                    }], /*[chunk.calc.lightTexData.buffer]*/);
                    endChunks++;
                }
                dayChanged = dayChanged || chunk.groundLevel.check();
            } else {
                if (chunk.sentID !== chunk.calc.dataID) {
                    chunk.sentID = chunk.calc.dataID;
                    this.postMessage(['light_generated', {
                        addr: chunk.addr,
                        lightData: chunk.calc.lightData,
                        lightID: chunk.sentID,
                        uniqId: chunk.uniqId,
                    }]);
                    endChunks++;
                }
            }
            if (endChunks >= resultLimit) {
                break;
            }
        }
        this.curChunkIndex = curChunkIndex;
        if (dayChanged) {
            this.groundLevel.estimateIfNecessary();
        }
    }

    onMessage(msg) {
        const cmd = msg[0];
        const args = msg[1];
        switch (cmd) {
            case 'createChunk': {
                let chunk = this.chunkManager.getChunk(args.addr);
                if (chunk) {
                    chunk.removed = true;
                    this.chunkManager.delete(chunk);
                }
                chunk = new Chunk(this, args);
                chunk.init();
                this.chunkManager.add(chunk);
                chunk.fillOuter();
                break;
            }
            case 'destructChunk': {
                const list = [];
                for (let props of args) {
                    let chunk = this.chunkManager.getChunk(props.addr);
                    if (chunk && chunk.uniqId === props.uniqId) {
                        list.push(chunk.lightChunk);
                        chunk.removed = true;
                    }
                }
                if (list.length > 0) {
                    this.chunkManager.deleteMultiple(list);
                }
                break;
            }
            case 'setChunkBlock': {
                this.setChunkBlock(args);
                break;
            }
            case 'genLayerParams': {
                if (args.ambientLight) {
                    this.light.setAmbient(adjustSrc(args.ambientLight));
                    this.dayLight.setAmbient(adjustSrc(args.ambientLight));
                }
            }
            case 'setPotentialCenter': {
                this.chunk_render_dist = args.chunk_render_dist;
                if (args.pos) {
                    this.chunkManager.nextPotentialCenter = new Vector(args.pos).round();
                    this.checkPotential();
                }
                break;
            }
        }
    }
}
