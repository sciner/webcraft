import { Helpers } from "../helpers.js";
import { Mesh_Effect_Manager } from "./effect.js";

// MeshManager
export class MeshManager {

    constructor() {
        this.chunks = new Map();
        this.list = new Map();
        this.effects = new Mesh_Effect_Manager(this);
    }

    get(id) {
        return this.list.get(id);
    }

    add(mesh, key) {
        if(!key) {
            key = Helpers.generateID();
        }
        this.remove(key, Qubatch.render);
        this.list.set(key, mesh);
        return mesh;
    }

    remove(key, render) {
        const keys = Array.from(this.list.keys());
        for(let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if(k.indexOf(key) == 0) {
                const item = this.list.get(k);
                item.destroy(render);
                this.list.delete(k);
            }
        }
    }

    //
    addForChunk(chunk_addr, mesh, key) {
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

    //
    removeForChunk(chunk_addr) {
        const chunk_addr_hash = chunk_addr.toHash();
        const chunk = this.chunks.get(chunk_addr_hash);
        if(!chunk) {
            return false;
        }
        for(const [key, mesh] of chunk.entries()) {
            this.remove(key, Qubatch.render);
        }
        this.chunks.delete(chunk_addr_hash);
        return true;
    }

    draw(render, delta, player_pos) {
        this.effects.tick(delta, player_pos);
        for(let [key, mesh] of this.list.entries()) {
            if(mesh.isAlive()) {
                mesh.draw(render, delta);
            } else {
                this.remove(key, render)
            }
        }
    }

}