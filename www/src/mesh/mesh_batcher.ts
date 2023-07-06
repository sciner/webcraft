import {SimplePool} from "../helpers/simple_pool.js";
import type {TerrainMaterial} from "../renders/terrain_material.js";

import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import {IvanArray, Vector} from "../helpers.js";
import type {TerrainGeometry15} from "../geom/terrain_geometry_15.js";
import type {Renderer} from "../render.js";
import type {MeshDrawer} from "./mesh_drawer.js";
import {MeshBuilder, MeshPart, TrivialMeshBuilder} from "./mesh_builder.js";
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
    drawMesh(geom: TerrainGeometry15, material: TerrainMaterial, pos: Vector, modelMatrix?: imat4): void;
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
    frame_mesh_builder = new MeshBuilder();
    // frame_mesh_builder = new TrivialMeshBuilder<TerrainGeometry15>(TerrainGeometry15);
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

    getMaterialNumber(mat: TerrainMaterial)
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

    drawMesh(geom: TerrainGeometry15, material: TerrainMaterial, pos: Vector, modelMatrix?: imat4) {
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

    drawPart(part: MeshPart, material: TerrainMaterial, pos: Vector, modelMatrix?: imat4) {
        if (!part.geom) {
            if (part.vertices.length === 0) {
                return;
            }
            this.frame_mesh_builder.addPart(part);
        }

        const entry = MeshBatcherEntry.pool.alloc();
        if (modelMatrix) {
            entry.hasModelMatrix = true;
            mat4.copy(entry.modelMatrix, modelMatrix);
        }
        entry.pos.copyFrom(pos);
        entry.geom = part.geom;
        entry.start = part.start;
        entry.count = part.count;
        entry.material = material;

        const renderListNum = this._renderListMode > 0 ?
            this._renderListMode : this.getMaterialNumber(material);

        this.elements[renderListNum].push(entry);
    }

    drawList(mode: MESH_RENDER_LIST)
    {
        if (this.frame_mesh_builder.vertices.length > 0)
        {
            this.frame_mesh_builder.buildGeom();
            this.frame_mesh_builder = new MeshBuilder();
        }

        const {pixiRender} = this.render.renderBackend;
        const mesh: MeshDrawer = pixiRender.plugins.mesh;
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
                entry.hasModelMatrix ? entry.modelMatrix : null, entry.count || entry.geom.size, entry.start);
        }
    }

    clear() {
        for (let i = 1; i < RENDER_LIST_NEXT; i++) {
            const list = this.elements[i];
            for (let j = 0; j < list.count; j++) {
                MeshBatcherEntry.pool.free(list.arr[j]);
            }
            list.clear();
        }
    }
}

export class MeshBatcherEntry {
    material: TerrainMaterial = null;
    geom: TerrainGeometry15 = null;
    pos = new Vector();
    modelMatrix: imat4 = mat4.create();
    hasModelMatrix = false;
    dist = 0;
    start = 0;
    count = 0;

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
        this.start = 0;
        this.count = 0;
    }

    static pool = new SimplePool(MeshBatcherEntry);
}
