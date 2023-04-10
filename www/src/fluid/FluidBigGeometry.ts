import {BaseBigGeometry, BigGeometryOptions} from "../geom/base_big_geometry.js";
import {FluidGeometryVao} from "./fluid_geometry_vao.js";

export class FluidBigGeometry extends BaseBigGeometry {
    constructor(options: BigGeometryOptions) {
        super(options);
        this.createIndex();
    }

    createGeom() {
        this.geomClass = FluidGeometryVao;
    }

    upload(shader) {
        super.upload(shader);
        if (!this.indexBuffer) {
            this.indexBuffer = this.context.createBuffer({
                data: this.indexData,
                usage: 'static',
                index: true
            });
        }
    }

    createIndex() {
        const size = this.staticSize;
        const indexData = this.indexData = new Int32Array(size * 6);

        for (let i = 0; i < size; i++) {
            indexData[i * 6] = i * 4;
            indexData[i * 6 + 1] = i * 4 + 1;
            indexData[i * 6 + 2] = i * 4 + 2;
            indexData[i * 6 + 3] = i * 4;
            indexData[i * 6 + 4] = i * 4 + 2;
            indexData[i * 6 + 5] = i * 4 + 3;
        }

        if (this.indexBuffer) {
            this.indexBuffer.data = this.indexData;
        }
    }

    resize(newSize) {
        super.resize(newSize);
        this.createIndex();
    }
}
