import GeometryTerrain from "../geometry_terrain.js";

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
        return new GeometryTerrain(vertices, chunkId);
    }
}
