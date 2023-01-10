import { DIRECTION } from "../../../helpers.js";
import { Building } from "../building.js";
import { BuildingTemplate } from "../building_template.js";

// Palettes
export class BuildingPalettes {

    constructor(cluster, rules, bm) {
        /**
         * @type {Object.<string, BuldingPalette>}
        */
        this.list = {};
        for(let k in rules) {
            this.list[k] = new BuldingPalette(cluster, rules[k], bm);
        }
    }

    //
    next(cluster, seed, door_direction, size, coord, aabb, entrance, door_bottom) {

        // generate random building from palette
        let building = null;
        const args = {cluster, seed, door_direction, size, coord, aabb, entrance, door_bottom};

        if(size.x == 1 && size.z == 1) {
            building = this.list.crossroad.next(args);
        }

        if(!building && this.list.required.buildings.length > 0) {
            building = this.list.required.next(args);
        }

        if(!building) {
            building = this.list.others.next(args);
        }

        if(!building) {
            throw 'error_proportional_fill_pattern';
        }

        return building

    }

}

// Palette
export class BuldingPalette {

    constructor(cluster, buildings, bm) {
        this.bm = bm;
        this.cluster = cluster;
        this.buildings = buildings
    }

    //
    next(args) {

        const {cluster, bm} = this;
        const {size} = args;
        const r = cluster.randoms.double();
        const door_direction = args.door_direction

        // each all buildings in this palette
        for(let i in this.buildings) {

            const b = this.buildings[i];
            if (r > b.chance) continue;

            //
            let found = false;
            let random_building = null;
            const variants = [];

            // 1. Prepare variants from old format
            if(b.class.SIZE_LIST) {
                if(!b.class.variants) {
                    b.class.variants = [];
                    for(let schema of b.class.SIZE_LIST) {
                        b.class.variants.push(new BuildingTemplate(schema, bm))
                    }
                }
                variants.push(...b.class.variants);
            }

            // 2. Prepare templates for new format (JSON blocks)
            if(b.block_templates) {
                if(!b.block_templates_compilled) {
                    b.block_templates_compilled = []
                    if(!b.class.json_variants) {
                        b.class.json_variants = new Map()
                    }
                    for(let name of b.block_templates) {
                        let template = b.class.json_variants.get(name);
                        if(!template) {
                            template = BuildingTemplate.fromSchema(name, bm)
                            b.class.json_variants.set(name, template)
                        }
                        b.block_templates_compilled.push(template)
                    }
                }
                variants.push(...b.block_templates_compilled);
            }

            // search random building size
            while(!found && variants.length) {
                const index = (variants.length * args.seed) | 0;
                random_building = variants[index];
                if([DIRECTION.NORTH, DIRECTION.SOUTH].includes(door_direction)) {
                    // x
                    found = random_building.size.x <= size.x && random_building.size.z <= size.z;
                } else {
                    // z
                    found = random_building.size.z <= size.x && random_building.size.x <= size.z;
                }
                if(!found) {
                    variants.splice(index, 1);
                }
            }

            // if random size founded
            if(found) {

                b.max_count--;
                if(b.max_count <= 0) {
                    this.buildings.splice(i, 1);
                }

                // calculate correct door position
                Building.selectSize(random_building, args.seed, args.coord, args.size, args.entrance, args.door_bottom, door_direction, args.aabb);

                // create object by pre-calculated arguments
                return new b.class(args.cluster, args.seed, args.coord, args.aabb, args.entrance, args.door_bottom, door_direction, args.size, random_building);

            }

        }

        debugger

        return null;

    }

}