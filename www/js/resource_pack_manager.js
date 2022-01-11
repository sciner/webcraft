import { BaseResourcePack } from "./base_resource_pack.js";
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
        resource_packs.add(new BaseResourcePack(def_resource_pack.path, def_resource_pack.id));

        // 2. extends
        for(let item of json.extends) {
            resource_packs.add(new BaseResourcePack(item.path, item.id));
        }

        // 3. variants
        const selected_variant_id = settings ? settings.texture_pack : null;

        if(settings?.texture_pack != def_resource_pack.id) {
            for(let item of json.variants) {
                if(!selected_variant_id || item.id == selected_variant_id) {
                    resource_packs.add(new BaseResourcePack(item.path, item.id));
                }
            }
        }

        // Load Resourse packs (blocks)
        for(let rp of resource_packs.values()) {
            this.list.set(rp.id, rp);
            await rp.init(this);
        }

    }

    get(id) {
        return this.list.get(id);
    }

    // registerResourcePack
    async registerResourcePack(rp) {
        this.list.set(rp.id, rp);

        await rp.init(this);

        return this;
    }

    // Init shaders for all resource packs
    async initShaders(renderBackend) {
        for (let value of this.list.values()) {
            await value.initShaders(renderBackend);
        }
    }

    // Init textures
    async initTextures(renderBackend, options) {
        for (let value of this.list.values()) {
            await value.initTextures(renderBackend, options);
        }
    }
}
