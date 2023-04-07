import {WorkerSubGeometry} from "../geom/worker_geometry_pool.js";
import {WorkerInstanceBuffer} from "../worker/WorkerInstanceBuffer.js";
import {FluidSubGeometry} from "./FluidSubGeometry.js";

export class FluidInstanceBuffer extends WorkerInstanceBuffer {
    [key: string]: any;
    initGeom() {
        this.vertices = new FluidSubGeometry({
            pool: this.geometryPool,
            chunkDataId: this.chunkDataId
        });
    }
}