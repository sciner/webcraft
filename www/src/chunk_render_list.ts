import {Basic05GeometryPool} from "./light/Basic05GeometryPool.js";
import {TrivialGeometryPool} from "./light/GeometryPool.js";
import {IvanArray, Vector, SpiralGrid} from "./helpers.js";
import {CubeTexturePool} from "./light/CubeTexturePool.js";
import {CHUNK_GENERATE_MARGIN_Y} from "./chunk_const.js";
import {GROUPS_NO_TRANSPARENT, GROUPS_TRANSPARENT} from "./chunk_manager.js";

import type {GeometryPool} from "./light/GeometryPool.js";
import type {Chunk} from "./chunk.js";
import type {ChunkManager} from "./chunk_manager.js";
import type {Renderer} from "./render.js";
import type {BaseResourcePack} from "./base_resource_pack.js";
import type {ChunkMesh} from "./chunk_mesh.js";
import {SpiralCulling} from "./render_tree/spiral_culling.js";

const MAX_APPLY_VERTICES_COUNT = 20;

export class ChunkRenderList {
    bufferPool: GeometryPool = null;
    chunkManager: ChunkManager;

    listByResourcePack: Map<string, Map<string, Map<string, IvanArray<ChunkMesh>>>> = new Map();
    meshLists: IvanArray<ChunkMesh>[] = [];
    prev_render_dist = -1;
    spiral = new SpiralGrid();
    culling = new SpiralCulling(this.spiral);

    constructor(chunkManager: ChunkManager) {
        this.chunkManager = chunkManager;
    }

    render: Renderer;

    init(render: Renderer) {
        const {chunkManager} = this;
        this.render = render;
        if (render.renderBackend.multidrawBaseExt) {
            this.bufferPool = new Basic05GeometryPool(render.renderBackend, {});
        } else {
            this.bufferPool = new TrivialGeometryPool(render.renderBackend);
        }
        chunkManager.fluidWorld.mesher.initRenderPool(render.renderBackend);

        const {lightProps} = this;
        const {chunkSize} = this.chunkManager.grid
        this.lightPool = new CubeTexturePool(render.renderBackend, {
            defWidth: chunkSize.x + 2,
            defHeight: chunkSize.z + 2,
            defDepth: (chunkSize.y + 2) * lightProps.depthMul,
            type: lightProps.texFormat,
            filter: 'linear',
        });
    }

    get centerChunkAddr() {
        return this.spiral.center;
    }

    /**
     * highly optimized
     */
    prepareRenderList() {
        const {chunkManager, render, spiral, culling} = this;

        const player = render.player;
        const chunk_render_dist = player.state.chunk_render_dist;
        const player_chunk_addr = player.chunkAddr;

        // if(!globalThis.dfdf)globalThis.dfdf=0
        // if(Math.random() < .01)console.log(globalThis.dfdf)

        if (!player_chunk_addr.equal(spiral.center) || this.prev_render_dist !== chunk_render_dist) {
            this.prev_render_dist = chunk_render_dist;

            let margin = Math.max(chunk_render_dist + 1, 1);
            spiral.makeOrTranslate(player_chunk_addr, new Vector(margin, CHUNK_GENERATE_MARGIN_Y, margin));

            for (let i = 0; i < spiral.entries.length; i++) {
                const entry = spiral.entries[i];
                if (!entry.translated && !entry.chunk) {
                    entry.chunk = chunkManager.chunks.get(entry.pos);
                }
            }

            const msg = {
                pos: player.pos,
                chunk_render_dist: player.state.chunk_render_dist
            };
            chunkManager.postWorkerMessage(['setPotentialCenter', msg]);
            chunkManager.postLightWorkerMessage(['setPotentialCenter', msg]);
        }

        chunkManager.fluidWorld.mesher.buildDirtyChunks(MAX_APPLY_VERTICES_COUNT);

        /**
         * please dont re-assign renderList entries
         */
        const {meshLists} = this;
        for (let i = 0; i < meshLists.length; i++) {
            meshLists[i].clear();
        }

        culling.update(render.frustum, chunkManager.dataWorld.grid.chunkSize);

        const {cullIDs, entries} = spiral;
        const cullID = culling.updateID;
        let cnt = 0;

        for (let i = 0; i < entries.length; i++) {
            if (cullIDs[i] !== cullID) {
                continue;
            }
            cnt++;
            const chunk = entries[i].chunk as Chunk
            if (!chunk || !chunk.chunkManager) {
                // destroyed!
                continue;
            }
            // actualize light
            chunk.prepareRender(render.renderBackend);
            if (chunk.need_apply_vertices) {
                if (this.bufferPool.checkHeuristicSize(chunk.vertices_args_size)) {
                    this.bufferPool.prepareMem(chunk.vertices_args_size);
                    chunk.vertices_args_size = 0;
                    chunk.applyChunkWorkerVertices();
                }
            }
            if (chunk.vertices_length === 0) {
                continue;
            }
            for (let i = 0; i < chunk.verticesList.length; i++) {
                let v = chunk.verticesList[i];
                v.rpl.push(v);
                chunk.rendered = 0;
            }
        }
        /*if (performance.now() % 1000 < 10) {
            console.log(`culling found ${cnt} chunks`);
        }*/
    }

    chunkAlive(chunk: Chunk) {
        this.spiral.setChunk(chunk.addr, chunk);
    }

    addChunkMesh(v: ChunkMesh) {
        let key1 = v.resource_pack_id;
        let key2 = v.material_group;
        let key3 = v.material_shader;
        let rpList = this.listByResourcePack.get(key1);
        if (!rpList) {
            this.listByResourcePack.set(key1, rpList = new Map());
        }
        let groupList = rpList.get(key2);
        if (!groupList) {
            rpList.set(key2, groupList = new Map());
        }
        if (!groupList.get(key3)) {
            const ia = new IvanArray();
            groupList.set(key3, ia);
            this.meshLists.push(ia);
        }
        v.rpl = groupList.get(key3);
    }

    /**
     * Draw level chunks
     */
    draw(render: Renderer, resource_pack: BaseResourcePack, transparent: boolean) {
        const {chunkManager} = this;
        if (!chunkManager.worker_inited || !chunkManager.nearby) {
            return;
        }
        const rpList = this.listByResourcePack.get(resource_pack.id);
        if (!rpList) {
            return true;
        }
        let groups = transparent ? GROUPS_TRANSPARENT : GROUPS_NO_TRANSPARENT;
        for (let group of groups) {
            const groupList = rpList.get(group);
            if (!groupList) {
                continue;
            }
            for (let [mat_shader, list] of groupList.entries()) {
                const {arr, count} = list;
                const shaderName = mat_shader === 'fluid' ? 'fluidShader' : 'shader';
                const mat = resource_pack[shaderName].materials[group];

                if (!mat.opaque && mat.shader.fluidFlags) {
                    // REVERSED!!!
                    for (let i = count - 1; i >= 0; i--) {
                        arr[i].draw(render.renderBackend, resource_pack, group, mat);
                        const chunk = arr[i].chunk;
                        if (chunk.rendered === 0) {
                            chunkManager.rendered_chunks.fact++;
                        }
                        chunk.rendered++;
                    }
                } else {
                    for (let i = 0; i < count; i++) {
                        arr[i].draw(render.renderBackend, resource_pack, group, mat);
                        const chunk = arr[i].chunk;
                        if (chunk.rendered === 0) {
                            chunkManager.rendered_chunks.fact++;
                        }
                        chunk.rendered++;
                    }
                }
            }
        }
        return true;
    }

    lightPool: CubeTexturePool = null;

    lightProps = {
        texFormat: 'rgba8unorm',
        hasTexture: true,
        depthMul: 1,
    }

    get lightmap_count() {
        return this.lightPool ? this.lightPool.totalRegions : 0;
    }

    get lightmap_bytes() {
        return this.lightPool ? this.lightPool.totalBytes : 0;
    }

    setLightTexFormat(hasNormals) {
        const {chunkManager} = this;
        this.lightProps.depthMul = hasNormals ? 2 : 1;
        chunkManager.lightWorker.postMessage([chunkManager.worldId, 'initRender', {
            hasTexture: true,
            hasNormals
        }])
    }
}