import { GeometryTerrain16 } from "./terrain_geometry_16.js";
import type {IChunkVertexBuffer} from "../chunk";

export class BaseGeometryPool {
    context: any;
    constructor(context) {
        this.context = context;
    }

    alloc({
        lastBuffer,
        vertices,
        chunkId
    } = {lastBuffer: null, vertices:null, chunkId:-1}) {
    }

    dealloc(buffer) {

    }

    checkHeuristicSize(instances: number) {
        return true;
    }

    prepareMem(instances: number) {
    }

    get bufferSizeBytes() {
        return 0;
    }

    static getVerticesMapSize(vertices: Dict<IChunkVertexBuffer>) {
        let res = 0;
        for (let v of Object.values(vertices)) {
            if (v.list.length > 1) {
                res += v.list[0];
            }
        }
        return res;
    }
}

export class TrivialGeometryPool extends BaseGeometryPool {
    constructor(context) {
        super(context);
    }

    alloc({ lastBuffer = null, vertices = null, chunkId = -1 } = {}) {
        if (lastBuffer) {
            lastBuffer.destroy();
        }

        const vert = new Float32Array(vertices[0] * GeometryTerrain16.strideFloats);
        let pos = 0;
        for (let i=1; i < vertices.length; i++) {
            const floatBuffer = new Float32Array(vertices[i]);
            vert.set(floatBuffer, pos);
            pos += floatBuffer.length;
        }

        return new GeometryTerrain16(vert);
    }
}
