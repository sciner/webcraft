import {BaseBigGeometry} from "./base_big_geometry.js";
import {TerrainGeometryVao} from "./terrain_geometry_vao.js";

export class TerrainBigGeometry extends BaseBigGeometry {
    static strideFloats = 16;

    createGeom() {
        this.geomClass = TerrainGeometryVao;
        super.createGeom();
    }
}
