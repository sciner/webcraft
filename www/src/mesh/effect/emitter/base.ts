import type { MeshManager } from "../../manager.js";

export class BaseEmitter {

    mesh_manager : MeshManager
    pos: any
    args: any

    constructor(mesh_manager : MeshManager, pos, args) {
        this.mesh_manager = mesh_manager
        this.args         = args;
        this.pos          = pos;
    }

}