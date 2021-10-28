import { BLOCK } from "./blocks.js";

export class ResourcePackManager {

    // constructor
    constructor() {
        this.list = new Set();
    }

    // registerResourcePack
    async registerResourcePack(module) {
        let rp = new module(BLOCK);
        this.list.add(rp);
        await Promise.all([
            rp.init()
        ]).then(() => {
            return this;
        });
    }

}