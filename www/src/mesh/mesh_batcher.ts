import {SimplePool} from "../helpers/simple_pool";
import type {BaseMaterial} from "../renders/TerrainMaterial";
import {Vector} from "../helpers/vector";

import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import {IvanArray} from "../helpers";
import type {GeometryTerrain} from "../geometry_terrain";
import type {Renderer} from "vauxcel";
const {mat4} = glMatrix;

export enum MESH_RENDER_LIST {
    AUTO = 0,
    OPAQUE = 1,
    TRANSPARENT = 2,
    BOATS = 3
}

export class MeshBatcher {
    elements: IvanArray<MeshBatcherEntry>[] = [];
    constructor() {
        this.elements.push(null);
        for (let i = 0; i < 3; i++) {
            this.elements.push(new IvanArray());
        }
    }

    forceRenderList: number = MESH_RENDER_LIST.AUTO;

    getMaterialNumber(mat: BaseMaterial)
    {
        if (mat.opaque) {
            return MESH_RENDER_LIST.OPAQUE;
        } else {
            return MESH_RENDER_LIST.TRANSPARENT;
        }
    }

    add(geom, material, pos, modelMatrix) {
        const entry = MeshBatcherEntry.pool.alloc();
        if (modelMatrix) {
            entry.hasModelMatrix = true;
            mat4.copy(entry.modelMatrix, modelMatrix);
        }
        entry.pos.copyFrom(pos);
        entry.geom = geom;
        entry.material = material;

        const renderListNum = this.forceRenderList > 0 ?
            this.forceRenderList : this.getMaterialNumber(material);

        this.elements[renderListNum].push(entry);
    }

    drawList(pixiRender: Renderer, mode: MESH_RENDER_LIST)
    {
        const {mesh} = pixiRender.plugins;
        pixiRender.batch.setObjectRenderer(mesh);
        const elements = this.elements[mode];
        for (let i = 0; i < elements.count; i++) {
            const entry = elements.arr[i];
            mesh.draw(entry.geom, entry.material, entry.pos,
                entry.hasModelMatrix ? entry.modelMatrix : null);
        }
    }

    clear() {
        for (let i = 0; i < 3; i++) {
            this.elements[i].clear();
        }
    }
}

export class MeshBatcherEntry {
    material: BaseMaterial = null;
    geom: GeometryTerrain = null;
    pos = new Vector();
    modelMatrix: imat4 = mat4.create();
    hasModelMatrix = false;

    reset()
    {
        this.material = null;
        this.geom = null;
        this.hasModelMatrix = false;
    }

    static pool = new SimplePool(MeshBatcherEntry);
}
