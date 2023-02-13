import { GeometryTerrain16 } from "../geom/TerrainGeometry16.js";

export class GeometryPool {
    [key: string]: any;
    constructor(context) {
        this.context = context;
    }

    alloc({
        lastBuffer,
        vertices,
        chunkId
    } = {}) {
    }

    dealloc(buffer) {

    }
}

export class TrivialGeometryPool extends GeometryPool {
    [key: string]: any;
    constructor(context, options) {
        super(context);
    }

    alloc({ lastBuffer, vertices,
              chunkId } = {}) {
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
