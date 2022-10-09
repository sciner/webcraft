import {Worker05SubGeometry} from "../light/Worker05GeometryPool.js";
import {WorkerInstanceBuffer} from "../worker/WorkerInstanceBuffer.js";
import {FluidSubGeometry} from "./FluidSubGeometry.js";

export class FluidInstanceBuffer extends WorkerInstanceBuffer {
    initGeom() {
        this.vertices = new FluidSubGeometry({
            pool: this.geometryPool,
            chunkDataId: this.chunkDataId
        });
    }
}