import {BigGeometryPool} from "../geom/big_geometry_pool.js";
import {FluidBigGeometry} from "./FluidBigGeometry.js";

export class FluidGeometryPool extends BigGeometryPool {
    [key: string]: any;
    constructor(context, {
        pageSize = 256,
        pageCount = 100,
        growCoeff = 1.5,
    }) {
        super(context, {pageSize, pageCount, growCoeff});
    }

    initBaseGeometry() {
        this.baseGeometry = new FluidBigGeometry({
            context: this.context, size: this.pageCount * this.pageSize
        })
    }
}