import { BaseResourcePack } from "./base_resource_pack.js";
import { Resources } from "./resources.js";
import type {BLOCK} from "./blocks.js";
import type { GameSettings } from "./game.js";

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

        const json              = await Resources.loadResourcePacks(settings)
        const def_resource_pack = json.base
        const resource_packs    : Set<BaseResourcePack> = new Set()

        // 1. base
        resource_packs.add(new BaseResourcePack(this.BLOCK, def_resource_pack.path, def_resource_pack.id))

        // 2. extends
        for(let item of json.extends) {
            if(!settings.only_bbmodel || item.id == 'bbmodel') {
                resource_packs.add(new BaseResourcePack(this.BLOCK, item.path, item.id))
            }
        }

        // 3. variants
        if(!settings.only_bbmodel) {
            const selected_variant_id = settings ? settings.texture_pack : null
            if(settings?.texture_pack != def_resource_pack.id) {
                for(let item of json.variants) {
                    if(!selected_variant_id || item.id == selected_variant_id) {
                        resource_packs.add(new BaseResourcePack(this.BLOCK, item.path, item.id))
                    }
                }
            }
        }

        // Load Resourse packs (blocks)
        for(let rp of resource_packs.values()) {
            this.list.set(rp.id, rp)
            await rp.init(this)
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
    async initTextures(renderBackend, settings : GameSettings) {
        const tasks = [];
        for (let value of this.list.values()) {
            if(!settings.only_bbmodel || value.id == 'bbmodel') {
                tasks.push(value.initTextures(renderBackend, settings))
            }
        }
        return Promise.all(tasks);
    }

}
