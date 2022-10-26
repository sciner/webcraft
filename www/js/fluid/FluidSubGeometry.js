import {Worker05SubGeometry} from "../light/Worker05GeometryPool.js";
import {FluidMultiGeometry} from "./FluidMultiGeometry.js";

export class FluidSubGeometry extends Worker05SubGeometry {
    constructor(params) {
        super(params);
    }

    push(fluidId, side, color,
         blockIndex,
         x0, y0, z0,
         x1, y1, z1,
         x2, y2, z2,
         x3, y3, z3,/*, arg15*/) {
        if (!this.lastPage || this.lastPage.filled === this.lastPage.sizeQuads) {
            this.pages.push(this.lastPage = this.pool.allocPage());
        }

        fluidId = fluidId | (side << 2) | (blockIndex << 5);

        const chunkId = this.chunkDataId;

        const data = this.lastPage.data, uint32Data = this.lastPage.uint32Data;
        let ind = (this.lastPage.filled++) * FluidMultiGeometry.strideFloats;
        this.filled++;

        // gl.vertexAttribPointer(attribs.a_chunkId, 1, gl.FLOAT, false, stride, 0 * 4);
        // gl.vertexAttribIPointer(attribs.a_fluidId, 1, gl.UNSIGNED_INT, stride, 1 * 4);
        // gl.vertexAttribPointer(attribs.a_position, 3, gl.FLOAT, false, stride, 2 * 4);
        // gl.vertexAttribPointer(attribs.a_uv, 2, gl.FLOAT, false, stride, 5 * 4);
        // gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, 7 * 4);

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = x0;
        data[ind + 4] = y0;
        data[ind + 5] = z0;

        ind += 6;

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = x1;
        data[ind + 4] = y1;
        data[ind + 5] = z1;

        ind += 6;

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = x2;
        data[ind + 4] = y2;
        data[ind + 5] = z2;

        ind += 6;

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = x0;
        data[ind + 4] = y0;
        data[ind + 5] = z0;

        ind += 6;

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = x2;
        data[ind + 4] = y2;
        data[ind + 5] = z2;

        ind += 6;

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = x3;
        data[ind + 4] = y3;
        data[ind + 5] = z3;
        // if (arg15) {
        //     console.log('old build logic');
        // }
    }
}