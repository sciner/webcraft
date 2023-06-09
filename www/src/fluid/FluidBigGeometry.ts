import {BaseBigGeometry, BigGeometryOptions} from "../geom/base_big_geometry.js";
import {FluidGeometryVao} from "./fluid_geometry_vao.js";
import {Buffer} from 'vauxcel';

export class FluidBigGeometry extends BaseBigGeometry {

    constructor(options: BigGeometryOptions) {
        super(options);
        this.createIndex();
    }

    createGeom() {
        this.geomClass = FluidGeometryVao;
        super.createGeom();
    }

    upload(shader) {
        super.upload(shader);
        if (!this.indexBuffer) {
            this.indexBuffer = new Buffer(this.indexData, true, true)
            this.staticDraw.addIndex(this.indexBuffer);
            if (this.staticCopy) {
                this.staticCopy.addIndex(this.indexBuffer);
            }
            this.dynamicDraw.addIndex(this.indexBuffer);
        }
        if (this.dynamicDraw.size * 6 > this.indexData.length) {
            this.createIndex();
        }
    }

    createIndex() {
        const size = Math.max(this.staticSize, this.dynamicDraw.size);
        if (this.indexData && this.indexData.length === size * 6) {
            return;
        }
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
            this.indexBuffer.update(this.indexData);
        }
    }

    resize(newSize) {
        super.resize(newSize);
        this.createIndex();
    }
}
