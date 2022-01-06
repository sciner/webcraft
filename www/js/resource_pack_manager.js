import { BLOCK } from "./blocks.js";
import { Resources } from "./resources.js";

export class ResourcePackManager {

    // constructor
    constructor() {
        this.list = new Map();
    }

    // init
    async init(settings) {
        const json              = await Resources.loadResourcePacks();
        const def_resource_pack = json.base;
        const resource_packs    = new Set();
        const all               = [];
        // 1. base
        all.push(import(def_resource_pack.path + '/init.js').then((module) => {resource_packs.add(module.default);}));
        // 2. extends
        for(let item of json.extends) {
            all.push(import(item.path + '/init.js').then((module) => {resource_packs.add(module.default);}));
        }
        // 3. variants
        const selected_variant_id = settings ? settings.texture_pack : null;
        if(settings?.texture_pack != def_resource_pack.id) {
            for(let item of json.variants) {
                if(!selected_variant_id || item.id == selected_variant_id) {
                    all.push(import(item.path + '/init.js').then((module) => {resource_packs.add(module.default);}));
                }
            }
        }
        await Promise.all(all).then(() => { return this; });
        // Load Resourse packs (blocks)
        for(let rp of resource_packs.values()) {
            await this.registerResourcePack(rp);
        }
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
