import { DIRECTION, Vector } from "../../../helpers.js";
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

    /**
     * @param {*} cluster
     * @param {*} seed
     * @param {int} door_direction
     * @param {Vector} size
     * @param {Vector} coord
     * @param {Vector} entrance
     * @param {boolean} is_crossroad
     * 
     * @returns 
     */
    next(cluster, seed, door_direction, size, coord, entrance, is_crossroad = false) {

        // generate random building from palette
        let building = null
        const args = {cluster, seed, door_direction, size, coord, entrance}

        // crossroad buildings
        if(is_crossroad) {
            building = this.list.crossroad.next(args)
            building.draw_entrance = false
        }

        if(!building && this.list.required.buildings.length > 0) {
            building = this.list.required.next(args)
        }

        if(!building) {
            building = this.list.others.next(args)
        }

        if(!building) {
            throw 'error_proportional_fill_pattern'
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
        const {size, door_direction} = args
        const r = cluster.randoms.double()

        // each all buildings in this palette
        for(let i in this.buildings) {

            const b = this.buildings[i];
            if (r > b.chance) continue;

            //
            let found = false;
            let building_template = null;
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
                building_template = variants[index];
                if([DIRECTION.NORTH, DIRECTION.SOUTH].includes(door_direction)) {
                    // x
                    found = building_template.size.x <= size.x && building_template.size.z <= size.z;
                } else {
                    // z
                    found = building_template.size.z <= size.x && building_template.size.x <= size.z;
                }
                if(!found) {
                    variants.splice(index, 1);
                }
            }

            // if random size founded
            if(found) {

                b.max_count--;
                if(b.max_count <= 0) {
                    this.buildings.splice(i, 1)
                }

                // calculate correct door position
                Building.selectSize(building_template, args.coord, args.size, args.entrance, door_direction)

                // create object by pre-calculated arguments
                return new b.class(args.cluster, args.seed, args.coord, args.entrance, door_direction, args.size, building_template)

            }

        }

        debugger

        return null;

    }

}