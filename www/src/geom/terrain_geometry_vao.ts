import type {GeometryVaoOptions} from "./base_geometry_vao.js";
import {BaseGeometryVao} from "./base_geometry_vao.js";
import {TYPES} from "vauxcel";
import {GeometryTerrain} from "../geometry_terrain.js";

export class TerrainGeometryVao extends BaseGeometryVao {
    static strideFloats = 16;

    constructor(options: GeometryVaoOptions) {
        options.strideFloats = options.strideFloats ?? 16;
        super(options);
        this.hasInstance = true;
    }

    initAttributes() {
        const { stride } = this;
        this.addAttribute('a_position', this.buffer, 3, false, undefined, stride, 0, 1);
        this.addAttribute('a_axisX', this.buffer, 3, false, undefined, stride, 3 * 4, 1);
        this.addAttribute('a_axisY', this.buffer, 3, false, undefined, stride, 6 * 4, 1);
        this.addAttribute('a_uvCenter', this.buffer, 2, false, undefined, stride, 9 * 4, 1);
        this.addAttribute('a_uvSize', this.buffer, 2, false, undefined, stride, 11 * 4, 1);
        this.addAttribute('a_color', this.buffer, 1, false, TYPES.UNSIGNED_INT, stride, 13 * 4, 1);
        this.addAttribute('a_flags', this.buffer, 1, false, TYPES.UNSIGNED_INT, stride, 14 * 4, 1);
        this.addAttribute('a_chunkId', this.buffer, 1, false, undefined, stride, 15 * 4, 1);
        this.addAttribute('a_quad', GeometryTerrain.quadBuf, 2, false, undefined, 2 * 4, 0);
    }
}
