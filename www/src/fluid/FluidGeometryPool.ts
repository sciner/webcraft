import {Basic05GeometryPool} from "../geom/Basic05GeometryPool.js";
import {FluidMultiGeometry} from "./FluidMultiGeometry.js";

export class FluidGeometryPool extends Basic05GeometryPool {
    [key: string]: any;
    constructor(context, {
        pageSize = 256,
        pageCount = 100,
        growCoeff = 1.5,
    }) {
        super(context, {pageSize, pageCount, growCoeff});
    }

    initBaseGeometry() {
        this.baseGeometry = new FluidMultiGeometry({
            context: this.context, size: this.pageCount * this.pageSize
        })
    }
}