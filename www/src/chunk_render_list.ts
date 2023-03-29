import {Basic05GeometryPool} from "./light/Basic05GeometryPool.js";
import {TrivialGeometryPool} from "./light/GeometryPool.js";
import {SpiralGenerator} from "./helpers/spiral_generator.js";
import {IvanArray, Vector} from "./helpers.js";
import {CubeTexturePool} from "./light/CubeTexturePool.js";
import {CHUNK_GENERATE_MARGIN_Y, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "./chunk_const.js";
import {GROUPS_NO_TRANSPARENT, GROUPS_TRANSPARENT} from "./chunk_manager.js";

import type {GeometryPool} from "./light/GeometryPool.js";
import type {Chunk} from "./chunk.js";
import type {ChunkManager} from "./chunk_manager.js";
import type {Renderer} from "./render.js";
import type {BaseResourcePack} from "./base_resource_pack.js";

const MAX_APPLY_VERTICES_COUNT  = 20;

export class ChunkRenderList {
    bufferPool : GeometryPool = null;
    chunkManager: ChunkManager;

    listByResourcePack: Map<string, Map<string, Map<string, IvanArray>>> = new Map();
    poses_chunkPos = new Vector(0, 0, 0);
    poses                  = [];
    poses_need_update      = false;

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
        this.lightPool = new CubeTexturePool(render.renderBackend, {
            defWidth: CHUNK_SIZE_X + 2,
            defHeight: CHUNK_SIZE_Z + 2,
            defDepth: (CHUNK_SIZE_Y + 2) * lightProps.depthMul,
            type: lightProps.texFormat,
            filter: 'linear',
        });
    }

    /**
     * highly optimized
     */
    prepareRenderList() {
        const {chunkManager, render} = this;

        const player = render.player;
        const chunk_render_dist = player.state.chunk_render_dist;
        const player_chunk_addr = player.chunkAddr;

        // if(!globalThis.dfdf)globalThis.dfdf=0
        // if(Math.random() < .01)console.log(globalThis.dfdf)

        const player_chunk_addr_changed = !player_chunk_addr.equal(this.poses_chunkPos)

        if (this.poses_need_update || player_chunk_addr_changed) {
            this.poses_need_update = false;

            let margin = Math.max(chunk_render_dist + 1, 1);
            let spiral_moves_3d = SpiralGenerator.generate3D(new Vector(margin, CHUNK_GENERATE_MARGIN_Y, margin)).entries;

            if(player_chunk_addr_changed) {
                for (let i = 0; i < spiral_moves_3d.length; i++) {
                    const item = spiral_moves_3d[i];
                    item._chunk = null
                }
            }

            const msg = {
                pos: player.pos,
                chunk_render_dist: player.state.chunk_render_dist
            };
            chunkManager.postWorkerMessage(['setPotentialCenter', msg]);
            chunkManager.postLightWorkerMessage(['setPotentialCenter', msg]);

            this.poses_chunkPos.copyFrom(player_chunk_addr);
            const pos               = this.poses_chunkPos;
            const pos_temp          = pos.clone();

            this.poses.length = 0;
            for (let i = 0; i < spiral_moves_3d.length; i++) {
                // globalThis.dfdf++
                const item = spiral_moves_3d[i];
                pos_temp.set(pos.x + item.pos.x, pos.y + item.pos.y, pos.z + item.pos.z);
                const chunk = item._chunk || (item._chunk = chunkManager.chunks.get(pos_temp))
                if (chunk) {
                    this.poses.push(chunk);
                }
            }
        }

        chunkManager.fluidWorld.mesher.buildDirtyChunks(MAX_APPLY_VERTICES_COUNT);

        /**
         * please dont re-assign renderList entries
         */
        const {listByResourcePack} = this;
        for (let v of listByResourcePack.values()) {
            for (let v2 of v.values()) {
                for (let v3 of v2.values()) {
                    v3.clear();
                }
            }
        }
        //

        for(let i = 0; i < this.poses.length; i++) {
            const chunk = this.poses[i] as Chunk
            if (!chunk.chunkManager) {
                // destroyed!
                continue;
            }
            if(chunk.vertices_length === 0 && !chunk.need_apply_vertices) {
                continue;
            }
            if(!chunk.updateInFrustum(render)) {
                continue;
            }
            if (chunk.need_apply_vertices) {
                if (this.bufferPool.checkHeuristicSize(chunk.vertices_args_size)) {
                    this.bufferPool.prepareMem(chunk.vertices_args_size);
                    chunk.vertices_args_size = 0;
                    chunk.applyChunkWorkerVertices();
                }
            }
            // actualize light
            chunk.prepareRender(render.renderBackend);
            if(chunk.vertices_length === 0) {
                continue;
            }
            for(let i = 0; i < chunk.verticesList.length; i++) {
                let v = chunk.verticesList[i];
                let rpl = v.rpl;
                if (!rpl) {
                    let key1 = v.resource_pack_id;
                    let key2 = v.material_group;
                    let key3 = v.material_shader;
                    if (!v.buffer) {
                        continue;
                    }
                    let rpList = listByResourcePack.get(key1);
                    if (!rpList) {
                        listByResourcePack.set(key1, rpList = new Map());
                    }
                    let groupList = rpList.get(key2);
                    if (!groupList) {
                        rpList.set(key2, groupList = new Map());
                    }
                    if (!groupList.get(key3)) {
                        groupList.set(key3, new IvanArray());
                    }
                    rpl = v.rpl = groupList.get(key3);
                }
                rpl.push(chunk);
                rpl.push(v);
                chunk.rendered = 0;
            }
        }
    }

    /**
     * Draw level chunks
     */
    draw(render : Renderer, resource_pack : BaseResourcePack, transparent : boolean) {
        const {chunkManager} = this;
        if(!chunkManager.worker_inited || !chunkManager.nearby) {
            return;
        }
        const rpList = this.listByResourcePack.get(resource_pack.id);
        if (!rpList) {
            return true;
        }
        let groups = transparent ? GROUPS_TRANSPARENT : GROUPS_NO_TRANSPARENT;
        for(let group of groups) {
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
                    for (let i = count - 2; i >= 0; i -= 2) {
                        const chunk = arr[i] as Chunk;
                        const vertices = arr[i + 1];
                        chunk.drawBufferVertices(render.renderBackend, resource_pack, group, mat, vertices);
                        if (!chunk.rendered) {
                            chunkManager.rendered_chunks.fact++;
                        }
                        chunk.rendered++;
                    }
                } else {
                    for (let i = 0; i < count; i += 2) {
                        const chunk = arr[i];
                        const vertices = arr[i + 1];
                        chunk.drawBufferVertices(render.renderBackend, resource_pack, group, mat, vertices);
                        if (!chunk.rendered) {
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