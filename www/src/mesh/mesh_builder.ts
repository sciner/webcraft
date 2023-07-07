import {TerrainGeometry15} from "../geom/terrain_geometry_15.js";
import {SimplePool} from "../helpers/simple_pool.js";
import type {TerrainMaterial} from "../renders/terrain_material";

interface IMeshInstanceGeometry {
    strideFloats: int;
    parts_counter: number;

    setVertices(vertices: any): void;
    destroy(): void;
}

export class MeshPart<T extends IMeshInstanceGeometry = TerrainGeometry15> {
    geom: T = null;
    /**
     * start instance
     */
    start: number = 0;
    /**
     * number of instances
     */
    count: number = 0;

    vertices: float[] = [];

    material?: TerrainMaterial = null;

    setGeom(geom: T, start: number, count: number) {
        this.geom = geom;
        this.start = start;
        this.count = count;
        this.geom.parts_counter++;
        this.vertices = [];
    }

    reset() {
        this.vertices.length = 0;
        //nothing
    }

    destroy()
    {
        if (!this.geom)
        {
            return;
        }
        this.geom.parts_counter--;
        if (this.geom.parts_counter === 0) {
            this.geom.destroy();
        }
        this.geom = null;
    }

    static pool = new SimplePool<MeshPart>(MeshPart);
}

export class MeshPartCollection<T extends IMeshInstanceGeometry = TerrainGeometry15> {
    entries: MeshPart<T>[] = [];

    getOrCreate(material: TerrainMaterial) {
        for (let i = 0; i < this.entries.length; i++) {
            if (this.entries[i].material === material) {
                return this.entries[i];
            }
        }
        let ret = new MeshPart<T>();
        ret.material = material;
        this.entries.push(ret);
        return ret;
    }

    destroy() {
        for (let i = 0; i < this.entries.length; i++) {
            this.entries[i].destroy();
        }
    }
}

export class MeshInstanceBuilder<T extends IMeshInstanceGeometry> {
    geom: T;
    vertices: Array<number> = [];
    current: MeshPart<T> = null;
    constructor(public clazz: new () => T) {
        this.geom = new clazz();
    }

    addPart(part: MeshPart<T>) {
        const start = this.vertices.length / this.geom.strideFloats;
        const count = part.vertices.length / this.geom.strideFloats;
        this.vertices.push(...part.vertices);
        part.setGeom(this.geom, start, count);
    }

    /**
     * creates geom
     */
    buildGeom() {
        this.geom.setVertices(this.vertices);
        return this.geom;
    }
}

export class TrivialMeshBuilder<T extends IMeshInstanceGeometry> extends MeshInstanceBuilder<T> {
    addPart(part: MeshPart<T>) {
        const geom = new this.clazz();
        geom.setVertices(part.vertices);
        part.setGeom(geom, 0, part.count);
    }
}

export class MeshBuilder extends MeshInstanceBuilder<TerrainGeometry15> {
    constructor() {
        super(TerrainGeometry15);
    }
}
