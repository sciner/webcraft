import {Helpers} from "./helpers.js";

// MeshManager
export class MeshManager {

    constructor() {
        this.list = new Map();
    }

    add(mesh, key) {
        if(!key) {
            key = Helpers.generateID();
        }
        this.list.set(key, mesh);
        return mesh;
    }

    remove(key, render) {
        this.list.get(key)?.destroy(render);
        this.list.delete(key);
    }

    draw(render, delta) {
        for(let [key, mesh] of this.list.entries()) {
            if(mesh.isAlive()) {
                mesh.draw(render, delta);
            } else {
                this.remove(key, render)
            }
        }
    }

}