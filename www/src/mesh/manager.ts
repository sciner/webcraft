import type { AABB } from "../core/AABB.js";
import { Helpers, makeChunkEffectID, Vector } from "../helpers.js";
import type { Renderer } from "../render.js";
import type { World } from "../world.js";
import { Mesh_Effect_Manager } from "./effect/manager.js";
import type { Mesh_Object_Base } from "./object/base.js";
import { Mesh_Object_BBModel } from "./object/bbmodel.js";

// MeshManager
export class MeshManager {
    chunks: Map<any, any>;
    list: Map<any, any>;
    effects: Mesh_Effect_Manager;
    world: World;

    constructor(world : World) {
        this.world = world
        this.chunks = new Map();
        this.list = new Map();
        this.effects = new Mesh_Effect_Manager(this);
    }

    get(id : string) {
        return this.list.get(id);
    }

    add(mesh : object, key? : string) : any {
        if(!key) {
            key = Helpers.generateID();
        }
        this.remove(key, Qubatch.render);
        this.list.set(key, mesh);
        return mesh;
    }

    remove(key : string, render : Renderer) {
        for(const [k, item] of this.list.entries()) {
            if(k.indexOf(key) == 0) {
                item.destroy(render);
                this.list.delete(k);
            }
        }
    }

    //
    addForChunk(chunk_addr : Vector, mesh, key : string) {
        const chunk_addr_hash = chunk_addr.toHash();
        let chunk = this.chunks.get(chunk_addr_hash);
        if(!chunk) {
            chunk = new Map();
            this.chunks.set(chunk_addr_hash, chunk);
        }
        //
        const exists = chunk.get(key);
        if(exists) {
            this.remove(key, Qubatch.render);
        }
        //
        chunk.set(key, mesh);
        this.list.set(key, mesh);
        return mesh;
    }

    removeForChunk(addr : Vector, aabb : AABB) {

        // 1.
        const PARTICLE_EFFECTS_ID = makeChunkEffectID(addr, null);
        this.remove(PARTICLE_EFFECTS_ID, Qubatch.render);
        this.effects.destroyAllInAABB(aabb); // Delete emitters

        // TODO: возможно тут происходят одинаковые действия с первым пунктом
        const chunk_addr_hash = addr.toHash();
        const chunk = this.chunks.get(chunk_addr_hash);
        if(!chunk) {
            return false;
        }
        for(const key of chunk.keys()) {
            this.remove(key, Qubatch.render);
        }
        this.chunks.delete(chunk_addr_hash);
        return true;
    }

    draw(render : Renderer, delta : float, player_pos : Vector) {
        this.effects.tick(delta, player_pos);
        for(let [key, mesh] of this.list.entries()) {
            if(mesh.isAlive) {
                if(mesh instanceof Mesh_Object_BBModel) {
                    mesh.drawBuffered(render, delta)
                } else {
                    mesh.draw(render, delta)
                }
            } else {
                this.remove(key, render)
            }
        }
    }

}