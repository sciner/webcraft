import { BaseResourcePack } from "./base_resource_pack.js";
import { BLOCK } from "./blocks.js";
import { Color } from "./helpers.js";
import { Resources } from "./resources.js";

const START_WOOL_ID = 350; // ... 365
const START_CARPET_ID = 800; // ... 815
const START_BUTTON_ID = 770; // ...799
const START_BED_ID = 1200; // ...1215

export const COLOR_PALETTE = {
    white: [0, 0],
    orange: [2, 1],
    magenta: [2, 3],
    light_blue: [3, 2],
    yellow: [3, 1],
    lime: [0, 2],
    pink: [3, 3],
    gray: [2, 0],
    light_gray: [1, 0],
    cyan: [2, 2],
    purple: [1, 3],
    blue: [0, 3],
    brown: [0, 1],
    green: [1, 2],
    red: [1, 1],
    black: [3, 0],
};

export class ResourcePackManager {

    // constructor
    constructor() {
        this.list = new Map();
    }

    // init
    async init(settings) {
        const json              = await Resources.loadResourcePacks(settings);
        const def_resource_pack = json.base;
        const resource_packs    = new Set();
        const all               = [];

        // 1. base
        const base = new BaseResourcePack(def_resource_pack.path, def_resource_pack.id);
        resource_packs.add(base);

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

        this.initWool(base);
        this.initCarpets(base);
        this.initButtons(base);
        this.initBed(base);

        // Load music discs
        for(let disc of await Resources.loadMusicDiscs()) {
            const b = {
                "id": disc.id,
                "name": "MUSIC_DISC_" + (disc.id - 900),
                "title": disc.title,
                "style": "extruder",
                "item": {"name": "music_disc"},
                "max_in_stack": 1,
                "material": {"id": "iron"},
                "texture": {"side": [0, 29]}
            };
            BLOCK.add(base, b);
        }

    }

    // Buttons
    initButtons(resource_pack) {
        let i = 0;
        const materials = [
            BLOCK.OAK_PLANK,
            BLOCK.BIRCH_PLANK,
            BLOCK.SPRUCE_PLANK,
            BLOCK.ACACIA_PLANK,
            BLOCK.JUNGLE_PLANK,
            BLOCK.DARK_OAK_PLANK,
            BLOCK.WARPED_PLANK,
            BLOCK.CONCRETE
        ];
        for(let mat of materials) {
            let name_prefix = mat.name.replace('_PLANK', '');
            const b = {
                "id": START_BUTTON_ID + i,
                "name": name_prefix + '_BUTTON',
                "material": mat.material,
                "sound": mat.sound,
                "texture": mat.texture,
                "width": 0.375,
                "height": 0.125,
                "depth": 0.25,
                "can_rotate": true,
                "transparent": true,
                "extra_data": {pressed: 0},
                "tags": [
                    "no_drop_ao",
                    "rotate_by_pos_n",
                    "button"
                ]
            };
            BLOCK.add(resource_pack, b);
            i++;
        }
    }

    // Wools
    initWool(resource_pack) {
        const palette_pos = {x: 24, y: 31};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const color_pos = COLOR_PALETTE[color];
            const mask_color = new Color(color_pos[0], color_pos[1], 0, 1);
            const TX_CNT = 32;
            mask_color.r = (palette_pos.x + 0.25 * mask_color.r + 0.125) / TX_CNT;
            mask_color.g = (palette_pos.y + 0.25 * mask_color.g + 0.125) / TX_CNT;
            const b = {
                "id": START_WOOL_ID + i,
                "name": color.toUpperCase() + '_WOOL',
                "material": {"id": "wool"},
                "sound": "madcraft:block.cloth",
                "texture": {"side": [10, 17]},
                "mask_color": mask_color,
                "tags": [
                    "can_put_info_pot",
                    "mask_color"
                ]
            };
            BLOCK.add(resource_pack, b);
            i++;
        }
    }

    // Beds
    initBed(resource_pack) {
        const palette_pos = {x: 24, y: 31};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const color_pos = COLOR_PALETTE[color];
            const mask_color = new Color(color_pos[0], color_pos[1], 0, 1);
            const TX_CNT = 32;
            mask_color.r = (palette_pos.x + 0.25 * mask_color.r + 0.125) / TX_CNT;
            mask_color.g = (palette_pos.y + 0.25 * mask_color.g + 0.125) / TX_CNT;
            const b = {
                "id": START_BED_ID + i,
                "name": color.toUpperCase() + '_BED',
                "material": {"id": "wood"},
                "style": "bed",
                "height": 0.5,
                "sound": "madcraft:block.wood",
                "transparent": true,
                "texture": {
                    "side": [12, 17],
                    "south": [16.375, 23.375],
                    "north": [16.375, 24.75]
                },
                "can_rotate": true,
                "inventory": {
                    "style": "extruder",
                    "texture": [4, 17]
                },
                "mask_color": mask_color,
                "tags": [
                    "bed",
                    "rotate_by_pos_n",
                    "mask_color"
                ]
            };
            BLOCK.add(resource_pack, b);
            i++;
        }
    }

    // Carpets
    initCarpets(resource_pack) {
        const palette_pos = {x: 24, y: 31};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const color_pos = COLOR_PALETTE[color];
            const mask_color = new Color(color_pos[0], color_pos[1], 0);
            const TX_CNT = 32;
            mask_color.r = (palette_pos.x + 0.25 * mask_color.r + 0.125) / TX_CNT;
            mask_color.g = (palette_pos.y + 0.25 * mask_color.g + 0.125) / TX_CNT;
            const b = {
                "id": START_CARPET_ID + i,
                "transparent": true,
                "height": 1/16,
                "can_rotate": true,
                "name": color.toUpperCase() + '_CARPET',
                "material": {"id": "wool"},
                "sound": "madcraft:block.cloth",
                "texture": {"side": [10, 17]},
                "mask_color": mask_color,
                "tags": [
                    "mask_color",
                    "rotate_by_pos_n",
                    "no_drop_ao"
                ]
            };
            BLOCK.add(resource_pack, b);
            i++;
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
