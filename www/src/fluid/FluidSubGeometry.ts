import {Worker05SubGeometry} from "../geom/Worker05GeometryPool.js";
import {FluidMultiGeometry} from "./FluidMultiGeometry.js";

export class FluidSubGeometry extends Worker05SubGeometry {
    [key: string]: any;
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
        let ind = (this.lastPage.filled++) * FluidMultiGeometry.strideFloats;
        this.filled++;

        // gl.vertexAttribPointer(attribs.a_chunkId, 1, gl.FLOAT, false, stride, 0 * 4);
        // gl.vertexAttribIPointer(attribs.a_fluidId, 1, gl.UNSIGNED_INT, stride, 1 * 4);
        // gl.vertexAttribPointer(attribs.a_position, 3, gl.FLOAT, false, stride, 2 * 4);
        // gl.vertexAttribPointer(attribs.a_uv, 2, gl.FLOAT, false, stride, 5 * 4);
        // gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, 7 * 4);

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