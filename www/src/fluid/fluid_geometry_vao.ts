import type {GeometryVaoOptions} from "../geom/base_geometry_vao.js";
import {BaseGeometryVao} from "../geom/base_geometry_vao.js";
import {TYPES} from "vauxcel";
import {GeometryTerrain} from "../geometry_terrain";

export class FluidGeometryVao extends BaseGeometryVao {
    static strideFloats = 16;
    static vertexPerInstance = 4;
    static indexPerInstance = 6;

    vertexPerInstance: number;
    indexPerInstance: number;

    constructor(options: GeometryVaoOptions) {
        options.strideFloats = options.strideFloats ?? 16;
        super(options);
        this.vertexPerInstance = FluidGeometryVao.vertexPerInstance;
        this.indexPerInstance = FluidGeometryVao.indexPerInstance;
        this.hasInstance = false;
    }

    initAttributes() {
        const stride = this.stride / this.vertexPerInstance;
        this.addAttribute('a_blockId', this.buffer, 1, false, TYPES.UNSIGNED_INT, stride, 0 * 4);
        this.addAttribute('a_fluidId', this.buffer, 1, false, TYPES.UNSIGNED_INT, stride, 1 * 4);
        this.addAttribute('a_color', this.buffer, 1, false, TYPES.UNSIGNED_INT, stride, 2 * 4);
        this.addAttribute('a_height', this.buffer, 1, false, TYPES.UNSIGNED_INT, stride, 3 * 4);
    }
}
