import { BaseResourcePack } from "./base_resource_pack.js";
import { Resources } from "./resources.js";
import type {BLOCK} from "./blocks.js";

export class ResourcePackManager {
    list: Map<any, any>
    settings: TBlocksSettings
    BLOCK: BLOCK

    // constructor
    constructor(block: BLOCK) {
        this.list = new Map();
        this.BLOCK = block;
    }

    // init
    async init(settings: TBlocksSettings) {

        this.settings = settings;

        const json              = await Resources.loadResourcePacks(settings);
        const def_resource_pack = json.base;
        const resource_packs    : Set<BaseResourcePack> = new Set();

        // 1. base
        const base = new BaseResourcePack(this.BLOCK, def_resource_pack.path, def_resource_pack.id);
        resource_packs.add(base);

        // 2. extends
        for(let item of json.extends) {
            resource_packs.add(new BaseResourcePack(this.BLOCK, item.path, item.id));
        }

        // 3. variants
        const selected_variant_id = settings ? settings.texture_pack : null;

        if(settings?.texture_pack != def_resource_pack.id) {
            for(let item of json.variants) {
                if(!selected_variant_id || item.id == selected_variant_id) {
                    resource_packs.add(new BaseResourcePack(this.BLOCK, item.path, item.id));
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
        const tasks = [];

        for (let value of this.list.values()) {
            tasks.push(value.initTextures(renderBackend, options));
        }

        return Promise.all(tasks);
    }
}
