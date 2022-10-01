import {Worker05SubGeometry} from "../light/Worker05GeometryPool.js";

export class FluidSubGeometry extends Worker05SubGeometry {
    constructor(params) {
        super(params);
    }

    push(fluidId, side, color,
         cx, cy, cz,
         x0, y0, z0, u0, v0,
         x1, y1, z1, u1, v1,
         x2, y2, z2, u2, v2,
         x3, y3, z3, u3, v3,/*, arg15*/) {
        if (!this.lastPage || this.lastPage.filled === this.lastPage.sizeQuads) {
            this.pages.push(this.lastPage = this.pool.allocPage());
        }

        fluidId = fluidId | (side << 2);

        const chunkId = this.chunkDataId;

        const data = this.lastPage.data, uint32Data = this.lastPage.uint32Data;
        let ind = (this.lastPage.filled++) * 48;
        this.filled++;

        // gl.vertexAttribPointer(attribs.a_chunkId, 1, gl.FLOAT, false, stride, 0 * 4);
        // gl.vertexAttribIPointer(attribs.a_fluidId, 1, gl.UNSIGNED_INT, stride, 1 * 4);
        // gl.vertexAttribPointer(attribs.a_position, 3, gl.FLOAT, false, stride, 2 * 4);
        // gl.vertexAttribPointer(attribs.a_uv, 2, gl.FLOAT, false, stride, 5 * 4);
        // gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, 7 * 4);

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = cx + x0;
        data[ind + 4] = cy + y0;
        data[ind + 5] = cz + z0;
        data[ind + 6] = u0;
        data[ind + 7] = v0;

        ind += 8;

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = cx + x1;
        data[ind + 4] = cy + y1;
        data[ind + 5] = cz + z1;
        data[ind + 6] = u1;
        data[ind + 7] = v1;

        ind += 8;

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = cx + x2;
        data[ind + 4] = cy + y2;
        data[ind + 5] = cz + z2;
        data[ind + 6] = u2;
        data[ind + 7] = v2;

        ind += 8;

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = cx + x0;
        data[ind + 4] = cy + y0;
        data[ind + 5] = cz + z0;
        data[ind + 6] = u0;
        data[ind + 7] = v0;

        ind += 8;

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = cx + x2;
        data[ind + 4] = cy + y2;
        data[ind + 5] = cz + z2;
        data[ind + 6] = u2;
        data[ind + 7] = v2;

        ind += 8;

        data[ind] = chunkId;
        uint32Data[ind + 1] = fluidId;
        uint32Data[ind + 2] = color;
        data[ind + 3] = cx + x3;
        data[ind + 4] = cy + y3;
        data[ind + 5] = cz + z3;
        data[ind + 6] = u3;
        data[ind + 7] = v3;
        // if (arg15) {
        //     console.log('old build logic');
        // }
    }
}