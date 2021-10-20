export class ResourcePackManager {

    // constructor
    constructor(block_manager) {
        this.list = new Set();
        this.block_manager = block_manager;
    }

    // registerResourcePack
    async registerResourcePack(module) {
        let rp = new module(this.block_manager);
        this.list.add(rp);
        await Promise.all([
            rp.init()
        ]).then(() => {
            return this;
        });
    }

}