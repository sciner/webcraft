import { BLOCK } from "./blocks.js";

export class ResourcePackManager {

    // constructor
    constructor() {
        this.list = new Map();
    }

    get(id) {
        return this.list.get(id);
    }

    // registerResourcePack
    async registerResourcePack(module) {
        let rp = new module(BLOCK);
        this.list.set(rp.id, rp);
        await Promise.all([
            rp.init()
        ]).then(() => {
            return this;
        });
    }

    // Init shaders for all resource packs
    async initShaders(renderBackend) {
        for (let [_, value] of this.list.entries()) {
            await value.initShaders(renderBackend);
        }
    }

    // Init textures
    async initTextures(renderBackend, options) {
        for (let [_, value] of this.list.entries()) {
            await value.initTextures(renderBackend, options);
        }
    }
}
