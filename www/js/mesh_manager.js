import {Helpers} from "./helpers.js";

// MeshManager
export class MeshManager {

    constructor() {
        this.list = {};
    }

    add(mesh, key) {
        if(!key) {
            key = Helpers.generateID();
        }
        this.list[key] = mesh;
        return mesh;
    }

    remove(key, render) {
        this.list[key].destroy(render);
        delete(this.list[key]);
    }

    draw(render, delta) {
        for(let key of Object.keys(this.list)) {
            let mesh = this.list[key];
            if(mesh.isAlive()) {
                mesh.draw(render, delta);
            } else {
                this.remove(key, render)
            }
        }
    }

}