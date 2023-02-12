import {Worker05GeometryPool} from "../light/Worker05GeometryPool.js";
import {FluidGeometryPool} from "./FluidGeometryPool.js";
import {FluidInstanceBuffer} from "./FluidInstanceBuffer.js";
import {buildFluidVertices} from "./FluidBuildVertices.js";

export class FluidMesher {
    constructor(world) {
        this.world = world;
        this.dirtyChunks = [];
        this.renderPool = null;
        this.geometryPool = new Worker05GeometryPool(null, {
            instanceSize: 16,
            pageSize: 256,
        });
    }

    initRenderPool(context) {
        if (this.renderPool) {
            return;
        }
        this.renderPool = new FluidGeometryPool(context, {
            pageSize: 256,
        });
    }

    // build the vertices!
    clearInstanceBuffers(fluidChunk) {
        if (!fluidChunk.instanceBuffers) {
            fluidChunk.instanceBuffers = new Map();
        }
        for (let entry of fluidChunk.instanceBuffers) {
            entry[1].clear();
        }
    }

    getInstanceBuffer(fluidChunk, material_key) {
        let ib = fluidChunk.instanceBuffers.get(material_key);
        if (!ib) {
            fluidChunk.instanceBuffers.set(material_key, ib = new FluidInstanceBuffer({
                material_key,
                geometryPool: this.geometryPool,
                chunkDataId: fluidChunk.dataId
            }));
        }
        return ib;
    }

    serializeInstanceBuffers(fluidChunk) {
        let serializedVertices = {};
        for (let entry of fluidChunk.instanceBuffers) {
            const vb = entry[1];
            if (vb.touched && vb.vertices.filled > 0) {
                serializedVertices[vb.material_key] = vb.getSerialized();
                vb.markClear();
            } else {
                fluidChunk.instanceBuffers.delete(entry[0]);
            }
        }
        return serializedVertices;
    }

    buildDirtyChunks(maxApplyVertexCount = 10) {
        const {dirtyChunks} = this;
        let limit = maxApplyVertexCount;
        let waitForChunk = [];
        while (dirtyChunks.length > 0 && limit > 0) {
            const fluidChunk = dirtyChunks.shift();
            const {parentChunk} = fluidChunk;
            if (!parentChunk.getChunkManager()) {
                continue;
            }
            if (fluidChunk.meshID === fluidChunk.updateID) {
                continue;
            }
            fluidChunk.meshID = fluidChunk.updateID;
            this.clearInstanceBuffers(fluidChunk);
            let serialized = {};
            if (buildFluidVertices(this, fluidChunk) > 0) {
                limit--;
                serialized = this.serializeInstanceBuffers(fluidChunk);
            }
            parentChunk.applyVertices('fluid', this.renderPool, serialized);
        }
    }
}