import {WorkerSubGeometry} from "../geom/worker_geometry_pool.js";
import {FluidGeometryVao} from "./fluid_geometry_vao.js";

export class FluidSubGeometry extends WorkerSubGeometry {
    constructor(params) {
        super(params);
    }

    push(fluidId, side, color,
         blockIndex, y0, y1, y2, y3,/*, arg15*/) {
        if (!this.lastPage || this.lastPage.filled === this.lastPage.sizeQuads) {
            this.pages.push(this.lastPage = this.pool.allocPage());
        }

        fluidId = fluidId | (side << 2);

        const blockId = (this.chunkDataId << 16) | blockIndex;

        const data = this.lastPage.data, uint32Data = this.lastPage.uint32Data;
        let ind = (this.lastPage.filled++) * FluidGeometryVao.strideFloats;
        this.filled++;

        uint32Data[ind] = blockId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = y0;

        ind += 4;

        uint32Data[ind] = blockId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = y1;

        ind += 4;

        uint32Data[ind] = blockId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = y2;

        ind += 4;

        uint32Data[ind] = blockId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = y3;
        // if (arg15) {
        //     console.log('old build logic');
        // }
    }
}