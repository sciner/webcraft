import {SimplePool} from "../helpers/simple_pool.js";
import type {BaseMaterial} from "../renders/TerrainMaterial.js";

import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import {IvanArray, Vector} from "../helpers.js";
import type {GeometryTerrain} from "../geometry_terrain.js";
import type {Renderer} from "../render.js";
const {mat4} = glMatrix;

export enum MESH_RENDER_LIST {
    AUTO = 0,
    OPAQUE = 1,
    OPAQUE_LAST = 2,
    TRANSPARENT_FIRST = 3,
    TRANSPARENT = 4,
}

const RENDER_LIST_NEXT = 5;

export interface IMeshDrawer {
    drawMesh(geom: GeometryTerrain, material: BaseMaterial, pos: Vector, modelMatrix?: imat4): void;
}

function meshSorter(mesh1: MeshBatcherEntry, mesh2: MeshBatcherEntry) {
    if (mesh1.dist < mesh2.dist)
    {
        return 1;
    }
    if (mesh1.dist > mesh2.dist)
    {
        return -1;
    }
    return 0;
}

export class MeshBatcher implements IMeshDrawer {
    elements: IvanArray<MeshBatcherEntry>[] = [];
    constructor() {
        this.elements.push(null);
        for (let i = 1; i < RENDER_LIST_NEXT; i++) {
            this.elements.push(new IvanArray());
        }
    }

    // extra params
    _renderListMode = MESH_RENDER_LIST.AUTO;
    _renderListStack = [];

    startRenderList(rl: MESH_RENDER_LIST) {
        this._renderListStack.push(this._renderListMode);
        this._renderListMode = rl;
    }

    finishRenderList() {
        this._renderListMode = this._renderListStack.pop();
    }

    getMaterialNumber(mat: BaseMaterial)
    {
        if (mat.opaque) {
            return MESH_RENDER_LIST.OPAQUE;
        } else {
            return MESH_RENDER_LIST.TRANSPARENT;
        }
    }

    render: Renderer = null;
    start(render: Renderer) {
        this.clear();
        this.render = render;
    }

    drawMesh(geom: GeometryTerrain, material: BaseMaterial, pos: Vector, modelMatrix?: imat4) {
        const entry = MeshBatcherEntry.pool.alloc();
        if (modelMatrix) {
            entry.hasModelMatrix = true;
            mat4.copy(entry.modelMatrix, modelMatrix);
        }
        entry.pos.copyFrom(pos);
        entry.geom = geom;
        entry.material = material;

        const renderListNum = this._renderListMode > 0 ?
            this._renderListMode : this.getMaterialNumber(material);

        this.elements[renderListNum].push(entry);
    }

    drawList(mode: MESH_RENDER_LIST)
    {
        const {pixiRender} = this.render.renderBackend;
        const {mesh} = pixiRender.plugins;
        pixiRender.batch.setObjectRenderer(mesh);
        const elements = this.elements[mode];

        if (mode === MESH_RENDER_LIST.TRANSPARENT)
        {
            for (let i = 0; i < elements.count; i++)
            {
                elements.arr[i].dist = this.render.camPos.distance(elements.arr[i].pos);
            }
            elements.arr.sort(meshSorter);
        }

        for (let i = 0; i < elements.count; i++) {
            const entry = elements.arr[i];
            mesh.draw(entry.geom, entry.material, entry.pos,
                entry.hasModelMatrix ? entry.modelMatrix : null);
        }
    }

    clear() {
        for (let i = 1; i < RENDER_LIST_NEXT; i++) {
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
    dist = 0;

    reset()
    {
        if (this.geom && this.geom.autoDestroy)
        {
            this.geom.destroy();
        }
        this.material = null;
        this.geom = null;
        this.hasModelMatrix = false;
        this.dist = 0;
    }

    static pool = new SimplePool(MeshBatcherEntry);
}
