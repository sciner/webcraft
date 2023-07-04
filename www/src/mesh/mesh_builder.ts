import {TerrainGeometry15} from "../geom/terrain_geometry_15.js";

interface IMeshInstanceGeometry {
    strideFloats: int;

    setVertices(vertices: any): void;
}

export class MeshPart<T = TerrainGeometry15> {
    geom: T;
    /**
     * start instance
     */
    start: number;
    /**
     * number of instances
     */
    count: number;
    constructor(geom: T, start: number, count: number)
    {
        this.geom = geom;
        this.start = start;
        this.count = count;
    }
}

export class MeshInstanceBuilder<T extends IMeshInstanceGeometry> {
    geom: T;
    vertices: Array<number> = [];
    current: MeshPart<T>;
    constructor(public clazz: new () => T) {
        this.geom = new clazz();
        this.current = new MeshPart<T>(this.geom, 0, 0)
    }

    buildPart() {
        const part = this.current;
        part.count = (this.vertices.length / this.geom.strideFloats) - part.start;
        this.current = new MeshPart<T>(this.geom, 0, 0);
        return part;
    }
    /**
     * creates geom
     */
    buildGeom() {
        this.geom.setVertices(this.vertices);
        return this.geom;
    }
}

export class MeshBuilder extends MeshInstanceBuilder<TerrainGeometry15> {
    constructor() {
        super(TerrainGeometry15);
    }
}
