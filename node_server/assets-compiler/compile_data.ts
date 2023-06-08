import { BLOCK_GROUP_TAG, DEFAULT_MOB_TEXTURE_NAME, MOB_TYPE } from "@client/constant.js";
import {Color} from "@client/helpers.js";
import { COLOR_PALETTE, Resources } from "@client/resources.js";

const START_WOOL_ID             = 350; // ... 365
const START_CARPET_ID           = 800; // ... 815
const START_BUTTON_ID           = 770; // ...799
const START_BED_ID              = 1200; // ...1215
const START_TERRACOTTA          = 1300; // 1316
const START_GLAZED_TERRACOTTA   = 1400; // 1415
const START_STAINED_GLASS       = 470; // ... 485
const START_STAINED_GLASS_PANE  = 1478; //
const START_CONCRETE            = 1500; // ... 1515
const START_CONCRETE_POWDER     = 1516; // ... 1531
const START_CANDLE              = 1532; // ... 1547
const START_WOOD_ID             = 221;
const START_PETRIFIED_SLAB_ID   = 203; //
const START_BANNER_ID           = 778;
const START_NUMBER_ID           = 209;
const START_FENCE_GATE_ID       = 911;
const START_SLOPE_ID            = 920;
const START_CHAIR_ID            = 300;
const START_STOOL_ID            = 320;

const INHERIT_EXCLUDES = ['id', 'name', 'inherit'];

const WOOD_PALETTE = ['BIRCH', 'OAK', 'ACACIA', 'SPRUCE', 'DARK_OAK', 'JUNGLE'/*, 'WARPED'*/];

// CompileData
export class CompileData {
    predefined_textures: any;
    predefined_style_props?:    { [key: string]: any }
    blocks: any[];

    constructor(compile_json) {
        Object.assign(this, compile_json);
    }

    //
    getBlock(name) {
        for(let block of this.blocks) {
            if(block.name == name) {
                return block;
            }
        }
        return null;
    }

    calcMaskColor(color, palette_pos) {
        const color_pos = COLOR_PALETTE[color];
        const mask_color = new Color(color_pos[0], color_pos[1], 0, 0);
        const TX_CNT = 32 / 1024.0;
        mask_color.r = (palette_pos.x + 0.25 * mask_color.r + 0.125) / TX_CNT;
        mask_color.g = (palette_pos.y + 0.25 * mask_color.g + 0.125) / TX_CNT;
        return mask_color
    }

    async init() {
        this.inheritAll();
        await this.initDiscs();
        this.initWool();
        this.initCarpets();
        this.initButtons();
        this.initTerracotta();
        this.initBed();
        this.initGlazedTerracotta();
        this.initSpawnEggs();
        this.initStainedGlass();
        this.initStainedGlassPane();
        this.initConcrete();
        this.initConcretePowder();
        this.initCandle();
        this.initWood();
        this.initPetrifiedSlab();
        this.initPressurePlate();
        this.initBanner();
        this.initFenceGate();
        this.initNumber();
        this.initSlope();
        this.initChairAndStool();
    }

    async initDiscs() {
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
                "texture": {"side": "item/music_disc_strad.png"}
            };
            this.blocks.push(b);
        }
    }

    // Wools
    initWool() {
        const palette_pos = {x: 0, y: 16};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const mask_color = this.calcMaskColor(color, palette_pos);
            const b = {
                "id": START_WOOL_ID + i,
                "name": color.toUpperCase() + '_WOOL',
                "material": {"id": "wool"},
                "sound": "madcraft:block.cloth",
                "texture": {"side": "block/white_wool.png"},
                "mask_color": mask_color,
                "tags": [
                    "wool",
                    "can_put_into_pot",
                    "mask_color"
                ]
            };
            this.blocks.push(b);
            i++;
        }
    }

    // Buttons
    initButtons() {
        let i = 0;
        const materials = [
            this.getBlock('OAK_PLANKS'),
            this.getBlock('BIRCH_PLANKS'),
            this.getBlock('SPRUCE_PLANKS'),
            this.getBlock('ACACIA_PLANKS'),
            this.getBlock('JUNGLE_PLANKS'),
            this.getBlock('DARK_OAK_PLANKS'),
            this.getBlock('WARPED_PLANKS'),
            this.getBlock('STONE')
        ];
        for(let mat of materials) {
            let name_prefix = mat.name.replace('_PLANKS', '');
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
                "extra_data": {powered: false},
                "tags": [
                    "no_drop_ao",
                    "rotate_by_pos_n_12",
                    "button"
                ],
                "support_style": "item_frame"
            };
            this.blocks.push(b);
            i++;
        }
    }

    // Beds
    initBed() {
        const palette_pos = {x: 0, y: 16};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const mask_color = this.calcMaskColor(color, palette_pos);
            mask_color.a = 1
            const b = {
                "id": START_BED_ID + i,
                "name": color.toUpperCase() + '_BED',
                "material": {"id": "wood"},
                "style": "bed",
                "height": 0.5,
                "max_in_stack": 1,
                "sound": "madcraft:block.wood",
                "transparent": true,
                "texture": {
                    "id": "entity",
                    "side": "24|28"
                },
                "can_rotate": true,
                "inventory": {
                    "style": "extruder",
                    "texture": {
                        "id": "entity",
                        "side": "24|31"
                    }
                },
                "mask_color": mask_color,
                "has_head": {"pos": {"x": 0, "y": 0, "z": 1}},
                "tags": [
                    BLOCK_GROUP_TAG.FURNITURE,
                    "bed",
                    "rotate_by_pos_n",
                    "mask_color"
                ]
            };
            this.blocks.push(b);
            i++;
        }
    }

    // Терракота (terracotta)
    initTerracotta() {
        const palette_pos = {x: 0, y: 16};
        let id = START_TERRACOTTA;
        for(let color in COLOR_PALETTE) {
            const mask_color = this.calcMaskColor(color, palette_pos);
            mask_color.a = 1
            // обычная 1300
            const b = {
                "id": id++,
                "name": color.toUpperCase() + '_TERRACOTTA',
                "material": {"id": "stone"},
                "sound": "madcraft:block.stone",
                "texture": {"side": "block/white_terracotta.png"},
                "coocked_item": {"name": color.toUpperCase() + '_GLAZED_TERRACOTTA', "count": 1},
                "mask_color": mask_color,
                "tags": [
                    "can_put_into_pot",
                    "mask_color"
                ]
            };
            this.blocks.push(b);
        }
        //
        this.blocks.push({
            "id": id,
            "name": 'TERRACOTTA',
            "material": {"id": "stone"},
            "sound": "madcraft:block.stone",
            "texture": {"side": "block/terracotta.png"},
            "tags": [
                "can_put_into_pot"
            ]
        });
    }

    // Carpets
    initCarpets() {
        const palette_pos = {x: 0, y: 16};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const mask_color = this.calcMaskColor(color, palette_pos);
            const b = {
                "id": START_CARPET_ID + i,
                "name": color.toUpperCase() + '_CARPET',
                "transparent": true,
                "height": 1/16,
                "can_rotate": true,
                "material": {"id": "wool"},
                "sound": "madcraft:block.cloth",
                "texture": {"side": "block/white_wool.png"},
                "mask_color": mask_color,
                "tags": [
                    "mask_color",
                    "carpet",
                    "rotate_by_pos_n",
                    "no_drop_ao"
                ],
                "support_style": "item_frame"
            };
            this.blocks.push(b);
            i++;
        }
    }

    // Glazed terracotta
    initGlazedTerracotta() {
        // const first_pos = {x: 29, y: 6};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const name = color.toUpperCase() + '_GLAZED_TERRACOTTA';
            const name_lower = name.toLowerCase();
            const b = {
                "id": START_GLAZED_TERRACOTTA + i,
                "name": name,
                "material": {"id": "stone"},
                "sound": "madcraft:block.stone",
                "uvlock": false,
                "texture": {
                    "side":     `block/${name_lower}.png`,
                    "up":       `block/${name_lower}.png`,
                    "north":    `block/${name_lower}.png;rc1`,
                    "south":    `block/${name_lower}.png;rc1`,
                    "west":     `block/${name_lower}.png`,
                },
                "compile": {
                    "add_3pos": {
                        "up":       0,
                        "north":    0,
                        "south":    3,
                        "west":     3,
                    },
                },
                "can_rotate": true,
                "tags": [
                    BLOCK_GROUP_TAG.DECORE,
                    "can_put_into_pot"
                ]
            };
            this.blocks.push(b);
            i++;
        }
    }

    // Spawn eggs
    initSpawnEggs() {

        const colors = {
            alay: {base: '#00DAFF', overlay: '#00ADFF'},
            axolotl: {base: '#FBC1E3', overlay: '#A62D74'},
            bat: {base: '#4C3E30', overlay: '#0F0F0F'},
            bee: {base: '#EDC343', overlay: '#43241B'},
            blaze: {base: '#F6B201', overlay: '#FFF87E'},
            cat: {base: '#EFC88E', overlay: '#957256'},
            cave_spider: {base: '#0C424E', overlay: '#A80E0E'},
            chicken: {base: '#A1A1A1', overlay: '#FF0000'},
            cod: {base: '#C1A76A', overlay: '#E5C48B'},
            cow: {base: '#443626', overlay: '#A1A1A1'},
            // creeper: {base: '#0DA70B', overlay: '#000000'},
            dolphin: {base: '#223B4D', overlay: '#F9F9F9'},
            donkey: {base: '#534539', overlay: '#867566'},
            drowned: {base: '#8FF1D7', overlay: '#799C65'},
            elder_guardian: {base: '#CECCBA', overlay: '#747693'},
            enderman: {base: '#161616', overlay: '#000000'},
            endermite: {base: '#161616', overlay: '#6E6E6E'},
            evoker: {base: '#959B9B', overlay: '#1E1C1A'},
            fox: {base: '#D5B69F', overlay: '#CC6920'},
            frog: {base: '#D07444', overlay: '#FFC77C'},
            ghast: {base: '#F9F9F9', overlay: '#BCBCBC'},
            glow_squid: {base: '#095656', overlay: '#85F1BC'},
            goat: {base: '#A5947C', overlay: '#55493E'},
            guardian: {base: '#5A8272', overlay: '#F17D30'},
            hoglin: {base: '#C66E55', overlay: '#5F6464'},
            horse: {base: '#C09E7D', overlay: '#EEE500'},
            husk: {base: '#797061', overlay: '#E6CC94'},
            llama: {base: '#C09E7D', overlay: '#995F40'},
            magma_cube: {base: '#340000', overlay: '#FCFC00'},
            mooshroom: {base: '#A00F10', overlay: '#B7B7B7'},
            mule: {base: '#1B0200', overlay: '#51331D'},
            ocelot: {base: '#EFDE7D', overlay: '#564434'},
            panda: {base: '#E7E7E7', overlay: '#1B1B22'},
            parrot: {base: '#0DA70B', overlay: '#FF0000'},
            phantom: {base: '#43518A', overlay: '#88FF00'},
            pig: {base: '#F0A5A2', overlay: '#DB635F'},
            piglin: {base: '#995F40', overlay: '#F9F3A4'},
            piglin_brute: {base: '#592A10', overlay: '#F9F3A4'},
            pillager: {base: '#532F36', overlay: '#959B9B'},
            polar_bear: {base: '#F2F2F2', overlay: '#959590'},
            pufferfish: {base: '#F6B201', overlay: '#37C3F2'},
            rabbit: {base: '#995F40', overlay: '#734831'},
            ravager: {base: '#757470', overlay: '#5B5049'},
            salmon: {base: '#A00F10', overlay: '#0E8474'},
            sheep: {base: '#E7E7E7', overlay: '#FFB5B5'},
            shulker: {base: '#946794', overlay: '#4D3852'},
            silverfish: {base: '#6E6E6E', overlay: '#303030'},
            skeleton: {base: '#C1C1C1', overlay: '#494949'},
            skeleton_horse: {base: '#68684F', overlay: '#E5E5D8'},
            slime: {base: '#51A03E', overlay: '#7EBF6E'},
            spider: {base: '#342D27', overlay: '#A80E0E'},
            squid: {base: '#223B4D', overlay: '#708899'},
            stray: {base: '#617677', overlay: '#DDEAEA'},
            strider: {base: '#9C3436', overlay: '#4D494D'},
            tadpole: {base: '#6D533D', overlay: '#160A00'},
            trader_llama: {base: '#EAA430', overlay: '#456296'},
            tropical_fish: {base: '#EF6915', overlay: '#FFF9EF'},
            turtle: {base: '#E7E7E7', overlay: '#00AFAF'},
            vex: {base: '#7A90A4', overlay: '#E8EDF1'},
            villager: {base: '#563C33', overlay: '#BD8B72'},
            vindicator: {base: '#959B9B', overlay: '#275E61'},
            wandering_trader: {base: '#456296', overlay: '#EAA430'},
            warden: {base: '#0F4649', overlay: '#39D6E0'},
            witch: {base: '#340000', overlay: '#51A03E'},
            wither_skeleton: {base: '#141414', overlay: '#474D4D'},
            wolf: {base: '#D7D3D3', overlay: '#CEAF96'},
            zoglin: {base: '#C66E55', overlay: '#E6E6E6'},
            zombie: {base: '#00AFAF', overlay: '#799C65'},
            zombie_horse: {base: '#315234', overlay: '#97C284'},
            zombified_piglin: {base: '#EA9393', overlay: '#4C7129'},
            zombie_villager: {base: '#563C33', overlay: '#799C65'},
            //
            deer: {base: '#9d9186', overlay: '#4a3f35'},
            snow_golem: {base: '#a5d8d8', overlay: '#96500a'},
            combat_dummy: {base: '#a008d8', overlay: '#96500a'}
        };

        const eggs = [
            {id: 521, type: MOB_TYPE.CHICKEN, skin: DEFAULT_MOB_TEXTURE_NAME},
            // {id: 522, type: MOB_TYPE.CREEPER, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 523, type: MOB_TYPE.PIG, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 524, type: MOB_TYPE.HORSE, skin: 'creamy'},
            {id: 525, type: MOB_TYPE.HORSE, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 651, type: MOB_TYPE.FOX, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1448, type: MOB_TYPE.SKELETON, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1449, type: MOB_TYPE.AXOLOTL, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1450, type: MOB_TYPE.BEE, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1451, type: MOB_TYPE.COW, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1453, type: MOB_TYPE.GOAT, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1454, type: 'mob/hoglin', skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1455, type: MOB_TYPE.OCELOT, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1456, type: MOB_TYPE.PANDA, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1457, type: 'mob/piglin', skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1458, type: MOB_TYPE.SHEEP, skin: DEFAULT_MOB_TEXTURE_NAME},
            //
            {id: 1452, type: MOB_TYPE.DEER, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1459, type: MOB_TYPE.SNOW_GOLEM, skin: DEFAULT_MOB_TEXTURE_NAME},
            {id: 1106, type: MOB_TYPE.COMBAT, skin: DEFAULT_MOB_TEXTURE_NAME},
            /*
            Under construction:
            - bat
            - spider
            - pillager
            */
        ];
        for(let egg of eggs) {
            const color = colors[egg.type.substring(4)];
            const b = {
                "id": egg.id,
                "name": "SPAWN_EGG_" + egg.type.toUpperCase(),
                "style": "extruder",
                "material": {
                    "id": "bone"
                },
                "spawn_egg": {
                    "type": egg.type,
                    "skin": egg.skin
                },
                "compile": {
                    overlay_color: color.base,
                    layers: [
                        {image: 'item/spawn_egg_overlay.png', overlay_color: color.overlay}
                    ]
                },
                "texture": {
                    "side": `item/spawn_egg.png;type=${egg.type}` // disable cache for every egg
                }
            };
            this.blocks.push(b);
        }
    }

    //
    initStainedGlass() {
        const palette_pos = {x: 0, y: 16};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const mask_color = this.calcMaskColor(color, palette_pos);
            mask_color.a = 1
            const b = {
                "id": START_STAINED_GLASS + i,
                "name": color.toUpperCase() + '_STAINED_GLASS',
                "material": {"id": "glass"},
                "transparent": true,
                "tags": [
                    BLOCK_GROUP_TAG.BLOCK,
                    "is_solid_for_fluid"
                ],
                "sound": "madcraft:block.glass",
                "texture": `block/${color}_stained_glass.png`
            };
            this.blocks.push(b);
            i++;
        }
    }

    //
    initStainedGlassPane() {
        const palette_pos = {x: 0, y: 16};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const mask_color = this.calcMaskColor(color, palette_pos);
            mask_color.a = 1
            const b = {
                "id": START_STAINED_GLASS_PANE + i,
                "name": color.toUpperCase() + '_STAINED_GLASS_PANE',
                "material": {"id": "glass"},
                "transparent": true,
                "style": "pane",
                "sound": "madcraft:block.glass",
                "group": "transparent",
                "inventory_style": "extruder",
                "can_rotate": true,
                // "tags": ["alpha"],
                "texture": {
                    "side": `block/${color}_stained_glass.png`,
                    "up": `block/${color}_stained_glass_pane_top.png`,
                    "up_rot": `block/${color}_stained_glass_pane_top.png;rc1`
                }
            };
            this.blocks.push(b);
            i++;
        }
    }

    initConcrete() {
        const palette_pos = {x: 24, y: 31};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const mask_color = this.calcMaskColor(color, palette_pos);
            mask_color.a = 1
            const b = {
                "id": START_CONCRETE + i,
                "name": color.toUpperCase() + '_CONCRETE',
                "material": {"id": "stone"},
                "sound": "madcraft:block.stone",
                "texture": `block/${color}_concrete.png`
            };
            this.blocks.push(b);
            i++;
        }
    }

    initConcretePowder() {
        const palette_pos = {x: 0, y: 16};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const mask_color = this.calcMaskColor(color, palette_pos);
            mask_color.a = 1
            const b = {
                "id": START_CONCRETE_POWDER + i,
                "name": color.toUpperCase() + '_CONCRETE_POWDER',
                "material": {"id": "stone"},
                "sound": "madcraft:block.stone",
                "texture": `block/${color}_concrete_powder.png`
            };
            this.blocks.push(b);
            i++;
        }
    }

    //
    initCandle() {
        const palette_pos = {x: 0, y: 16};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const mask_color = this.calcMaskColor(color, palette_pos);
            mask_color.a = 1
            const b = {
                "id": START_CANDLE + i,
                "name": color.toUpperCase() + '_CANDLE',
                "material": {"id": "clay"},
                "sound": "madcraft:block.cloth",
                "inventory": {
                    "scale": 3
                },
                "transparent": true,
                "style": "candle",
                "mining_time": 0,
                "texture": `block/${color}_candle.png`,
                "tags": [
                    "no_set_on_top",
                    "no_drop_ao"
                ],
                "light_power": {
                    "r": 255,
                    "g": 235,
                    "b": 35,
                    "a": 255
                }
            };
            this.blocks.push(b);
            i++;
        }
    }

    //
    initWood() {
        let id = START_WOOD_ID;
        for(let w of WOOD_PALETTE) {
            const w_lower = w.toLowerCase();
            const b = {
                "id":       id++,
                "name":     w + '_WOOD',
                "material": {"id": "wood"},
                "sound":    "madcraft:block.wood",
                "texture":  `block/${w_lower}_log.png`
            };
            this.blocks.push(b);
        }
    }

    //
    initPetrifiedSlab() {
        let id = START_PETRIFIED_SLAB_ID;
        for(let w of WOOD_PALETTE) {
            const w_lower = w.toLowerCase();
            const b = {
                "id":       id++,
                "name":     `PETRIFIED_${w}_SLAB`,
                "transparent": true,
                "sound": "madcraft:block.stone",
                "height": 0.5,
                "layering": {
                    "height": 0.5,
                    "slab": true
                },
                "material": {
                    "id": "stone"
                },
                "texture": `block/${w_lower}_planks.png`
            };
            this.blocks.push(b);
        }

    }

    initPressurePlate() {

        const plates = [
            {id: 72, name: 'OAK', texture: 'block/oak_planks.png', material: 'wood'},
            {id: 579, name: 'STONE', texture: 'block/stone.png', material: 'stone'},
            {id: 581, name: 'POLISHED_BLACKSTONE', texture: 'block/polished_blackstone.png', material: 'stone'},
            {id: 583, name: 'LIGHT_WEIGHTED', texture: 'block/gold_block.png', material: 'stone'},
            {id: 585, name: 'HEAVY_WEIGHTED', texture: 'block/iron_block.png', material: 'stone'},
            {id: 587, name: 'SPRUCE', texture: 'block/spruce_planks.png', material: 'wood'},
            {id: 589, name: 'BIRCH', texture: 'block/birch_planks.png', material: 'wood'},
            {id: 591, name: 'JUNGLE', texture: 'block/jungle_planks.png', material: 'wood'},
            {id: 619, name: 'ACACIA', texture: 'block/acacia_planks.png', material: 'wood'},
            {id: 994, name: 'DARK_OAK', texture: 'block/dark_oak_planks.png', material: 'wood'},
            {id: 996, name: 'CRIMSON', texture: 'block/crimson_planks.png', material: 'wood'},
            {id: 74, name: 'WARPED', texture: 'block/warped_planks.png', material: 'wood'},
        ];

        for(let p of plates) {
            this.blocks.push({
                "id": p.id,
                "name": `${p.name}_PRESSURE_PLATE`,
                "sound": `madcraft:block.${p.material}`,
                "width": 14/16,
                "height": 0.03125,
                "texture": p.texture,
                "transparent": true,
                "material": {
                    "id": p.material
                },
                "tags": [
                    "set_only_fullface",
                    "no_drop_ao"
                ],
                "support_style": "bottom"
            });
        }
    }

    initBanner() {
        const palette_pos = {x: 0, y: 16};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const mask_color = this.calcMaskColor(color, palette_pos);
            mask_color.b = 4
            const b = {
                "id": START_BANNER_ID + i,
                "name": color.toUpperCase() + '_BANNER',
                "material": {"id": "wood"},
                "transparent": true,
                "style": "banner",
                "max_in_stack": 1,
                "sound": "madcraft:block.wood",
                "can_rotate": true,
                "mask_color": mask_color,
                "texture": {
                    "id": "entity",
                    "side": "16|28"
                },
                "inventory": {
                    "scale": .75,
                    "rotate": {"x": 0, "y": Math.PI * .9, "z": 0},
                    "move": {"x": 0, "y": 0.5, "z": 0}
                },
                "tags": [
                    "banner",
                    "no_drop_ao",
                    "rotate_x16",
                    "mask_color"
                ]
            };
            this.blocks.push(b);
            i++;
        }
    }

    // Fence gates
    initFenceGate() {
        let id = START_FENCE_GATE_ID;
        const FENCE_GATE_PALETTE = [
            {name: 'BIRCH', 'texture': `block/birch_planks.png`},
            {name: 'OAK', 'texture': `block/oak_planks.png`},
            {name: 'ACACIA', 'texture': `block/acacia_planks.png`},
            {name: 'SPRUCE', 'texture': `block/spruce_planks.png`},
            {name: 'DARK_OAK', 'texture': `block/dark_oak_planks.png`},
            {name: 'JUNGLE', 'texture': `block/jungle_planks.png`},
            {name: 'CRIMSON', 'texture': `block/crimson_planks.png`},
            {name: 'WARPED', 'texture': `block/warped_planks.png`},
            {name: 'NETHER_BRICK', 'texture': `block/nether_bricks.png`},
        ];
        for(let p of FENCE_GATE_PALETTE) {
            const b = {
                "id":           id++,
                "name":         `${p.name}_FENCE_GATE`,
                "transparent":  true,
                "can_rotate":   true,
                "style":        "fence_gate",
                "sound":        "madcraft:block.wooden_trapdoor",
                "material":     {
                    "id": "wood"
                },
                "texture":      p.texture,
                "extra_data": {
                    "opened": false,
                    "facing": "north"
                },
                "tags": [
                    "no_drop_ao"
                ]
            };
            this.blocks.push(b);
        }
    }

    initNumber() {
        let id = START_NUMBER_ID;
        for(let i = 0; i < 2; i++) {
            const num = i + 1
            const b = {
                "id":           id + i,
                "name":         `NUM${num}`,
                "transparent":  true,
                "sound":        "madcraft:block.wood",
                "mining_time":  0,
                "material": {
                    "id": "wood"
                },
                "texture": {
                    "side": `block/${num}.png`
                },
                "tags": [
                    "no_drop_ao"
                ]
            };
            this.blocks.push(b);
        }
    }

    initSlope() {
        let id = START_SLOPE_ID;
        const PALETTE = [
            {name: 'BIRCH', 'texture': `block/birch_planks.png`},
            {name: 'OAK', 'texture': `block/oak_planks.png`},
            {name: 'ACACIA', 'texture': `block/acacia_planks.png`},
            {name: 'SPRUCE', 'texture': `block/spruce_planks.png`},
            {name: 'DARK_OAK', 'texture': `block/dark_oak_planks.png`},
            {name: 'JUNGLE', 'texture': `block/jungle_planks.png`},
            {name: 'CRIMSON', 'texture': `block/crimson_planks.png`},
            {name: 'WARPED', 'texture': `block/warped_planks.png`},
            {name: 'STRIPPED_OAK_WOOD', 'texture': `block/stripped_oak_log.png`},
            {name: 'STRIPPED_BIRCH_WOOD', 'texture': `block/stripped_birch_log.png`},
            {name: 'STRIPPED_ACACIA_WOOD', 'texture': `block/stripped_acacia_log.png`},
            {name: 'STRIPPED_SPRUCE_WOOD', 'texture': `block/stripped_spruce_log.png`},
            {name: 'STRIPPED_DARK_OAK_WOOD', 'texture': `block/stripped_dark_oak_log.png`},
            {name: 'STRIPPED_JUNGLE_WOOD', 'texture': `block/stripped_jungle_log.png`},
            {name: 'STRIPPED_WARPED_WOOD', 'texture': `block/stripped_warped_stem.png`},
            {name: 'HAY', 'texture': {
                "side": "block/hay_block_side.png",
                "down": "block/hay_block_top.png"
            }, "sound": "madcraft:block.grass"},
            {name: 'BASALT', 'texture': {
                "side": "block/basalt_side.png",
                "down": "block/basalt_top.png"
            }, "sound": "madcraft:block.stone", "material": {"id": "stone"}},
            {name: 'MOSS_STONE', 'texture': "block/mossy_cobblestone.png", "sound": "madcraft:block.stone", "material": {"id": "stone"}},
            {name: 'MOSS_BLOCK', 'texture': "./textures/moss_block.png", "sound": "madcraft:block.grass", "material": {"id": "cobblestone"}},
            {name: 'COBBLESTONE', 'texture': "block/cobblestone.png", "sound": "madcraft:block.stone", "material": {"id": "stone"}},
            {name: 'SAND', 'texture': `block/sand.png`},
        ];
        for(let p of PALETTE) {
            let b = {
                "id":           id++,
                "name":         `${p.name}_SLOPE`,
                "transparent":  true,
                "can_rotate":   true,
                "style":        "slope",
                "sound":        "madcraft:block.wood",
                "material":     {"id": "wood"},
                "extra_data": {
                    "shape": 0
                },
                "tags": [
                    "stairs",
                    "no_drop_ao"
                ]
            };
            delete(p.name);
            b = {...b, ...p};
            this.blocks.push(b);
        }
    }

    /**
     * chairs and stools
     */
    initChairAndStool() {

        const FURNITURE_MATERIALS = [
            {prefix: 'BIRCH', log: 'birch_log', texture: 'block/birch_log_top.png'},
            {prefix: 'OAK', log: 'oak_log', texture: 'block/oak_log_top.png'},
            {prefix: 'ACACIA', log: 'acacia_log', texture: 'block/acacia_log_top.png'},
            {prefix: 'SPRUCE', log: 'spruce_log', texture: 'block/spruce_log_top.png'},
            {prefix: 'DARK_OAK', log: 'dark_oak_log', texture: 'block/dark_oak_log_top.png'},
            {prefix: 'JUNGLE', log: 'jungle_log', texture: 'block/jungle_log_top.png'},
            {prefix: 'CRIMSON', log: 'crimson_stem', texture: 'block/crimson_stem_top.png'},
            {prefix: 'WARPED', log: 'warped_stem', texture: 'block/warped_stem_top.png'}
        ];

        for(let i = 0; i < FURNITURE_MATERIALS.length; i++) {
            const item = FURNITURE_MATERIALS[i];
            // stool
            this.blocks.push({
                "id": START_STOOL_ID + i,
                "can_rotate": true,
                "transparent": true,
                "mining_time": 0,
                "name": `${item.prefix}_STOOL`,
                "sound": "madcraft:block.wood",
                "style": "stool",
                "fuel_time": 16,
                "material": {
                    "id": "wood"
                },
                "tags": [
                    BLOCK_GROUP_TAG.FURNITURE,
                    "no_drop_ao",
                    "rotate_x8"
                ],
                "extra_data": {
                    // "upholstery": "white_wool",
                    "frame": item.log
                },
                "texture": item.texture
            });
            // chair
            this.blocks.push({
                "id": START_CHAIR_ID + i,
                "can_rotate": true,
                "transparent": true,
                "mining_time": 0,
                "name": `${item.prefix}_CHAIR`,
                "sound": "madcraft:block.wood",
                "style": "chair",
                "fuel_time": 16,
                "material": {
                    "id": "wood"
                },
                "tags": [
                    BLOCK_GROUP_TAG.FURNITURE,
                    "no_drop_ao",
                    "rotate_x8"
                ],
                "inventory": {
                    "scale": 0.8,
                    "move": {"x": -0.2, "y": -0.2, "z": 0}
                },
                "extra_data": {
                    "frame": item.log
                },
                "has_head": {
                    "pos": {
                        "x": 0,
                        "y": 1,
                        "z": 0
                    }
                },
                "texture": item.texture
            });
        }

    }

    /**
     * Copies properties of one block to another, excluding 'id', 'name' and 'inherit'.
     * If dstBlock already has a property, it won't be replaced.
     * If dstBlock's property is null, it won't be replaced, and will be deleted.
     */
    inherit(dstBlock, srcBlockName) {
        if (!srcBlockName) {
            return;
        }
        dstBlock.inherit = '<circular dependency> ' + srcBlockName; // to detect circlular dependencies
        const srcBlock = this.getBlock(srcBlockName);
        if (!srcBlock) {
            throw new Error(`Id=${dstBlock.id} "${dstBlock.name}" can't inherit from non-existing block "${srcBlockName}"`);
        }
        this.inherit(srcBlock, srcBlock.inherit);
        const srcCopy = JSON.parse(JSON.stringify(srcBlock));
        for(let key in srcCopy) {
            if (!INHERIT_EXCLUDES.includes(key)) {
                if (!(key in dstBlock)) {
                    dstBlock[key] = srcCopy[key];
                } else if (dstBlock[key] === null) {
                    delete dstBlock[key];
                }
            }
        }
        delete dstBlock.inherit;
    }

    inheritAll() {
        for(let block of this.blocks) {
            this.inherit(block, block.piece_of ?? block.inherit);
        }
    }
}