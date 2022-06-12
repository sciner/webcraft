import { GeometryTerrain18 } from "../geom/TerrainGeometry18.js";

export class GeometryPool {
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
    constructor(context, options) {
        super(context);
    }

    alloc({ lastBuffer, vertices,
              chunkId } = {}) {
        if (lastBuffer) {
            lastBuffer.destroy();
        }

        const vert = new Float32Array(vertices[0] * GeometryTerrain.strideFloats);
        let pos = 0;
        for (let i=1; i < vertices.length; i++) {
            const floatBuffer = new Float32Array(vertices[i]);
            vert.set(floatBuffer, pos);
            pos += floatBuffer.length;
        }

        return new GeometryTerrain18(vert);
    }
}
