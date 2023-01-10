import { DIRECTION, Vector } from "../../helpers.js";
import { ClusterBuildingBase } from "./building_cluster_base.js";
import { BuildingPalettes } from "./building/palette.js";
import { BLOCK } from "../../blocks.js";
import { BuildingBlocks } from "./building/building_blocks.js";
import { BuildingTemplate } from "./building_template.js";

//
export class ClusterStructures extends ClusterBuildingBase {

    constructor(clusterManager, addr) {

        super(clusterManager, addr)

        this.max_height  = 1
        this.is_empty = !addr.equal(new Vector(-6576, 0, 8932))

        if(this.is_empty) {
            return
        }

        this.moveToRandomCorner()

        const bm = BLOCK

        /*
        let x = 20 //+ Math.floor(this.randoms.double() * 80)
        let z = 90 //+ Math.floor(this.randoms.double() * 80)
        // Building palettes
        this.building_palettes = new BuildingPalettes(this, {
            crossroad: [],
            required: [],
            others: [
                {class: BuildingBlocks, max_count: Infinity, chance: 1, block_templates: [
                    'test'
                    // 'structure1', 'structure2', 'mine', 'underearth_tower', 'broken_castle',
                    // 'house_dwarf', 'ornated_stone_tower_ruins'
                ]}
            ]
        }, BLOCK)

        const size1 = new Vector(128, 5, 128)
        const entrance_pos1 = new Vector(x, Infinity, z)
        const door_bottom1 = new Vector(x, Infinity, z)
        const building1 = this.addBuilding(this.randoms.double(), x, z - size1.z, size1,
            entrance_pos1, door_bottom1, DIRECTION.NORTH)
        */

        const template       = BuildingTemplate.fromSchema('medium_house', bm)
        const coord          = new Vector(-841664, 0, 1143398) // this.coord.clone().add(new Vector(x, 0, z))
        // const coord          = new Vector(-841676, 0, 1143357) // this.coord.clone().add(new Vector(x, 0, z))
        const door_bottom    = new Vector(coord.x, Infinity, coord.z)
        const door_direction = DIRECTION.SOUTH

        const building = new BuildingBlocks(this,
            this.randoms.double(),
            coord, // abs
            null, // abs
            null, // abs (y = infinity)
            door_bottom, // abs
            door_direction,
            template.size.clone(),
            template
        )

        this.buildings.set(building.coord, building)

        if(building) {

            // Fill near_mask
            const margin = 3
            for(const [pos, building] of this.buildings.entries()) {
                for(let i = -margin; i < building.size.x + margin; i++) {
                    for(let j = -margin; j < building.size.z + margin; j++) {
                        const x = pos.x - this.coord.x + i
                        const z = pos.z - this.coord.z + j
                        if(x >= 0 && z >= 0 && x < this.size.x && z < this.size.z) {
                            const nidx = z * this.size.x + x
                            this.near_mask[nidx] = margin
                        }
                    }
                }
            }

        } else {
            this.mask.fill(null)
        }

        /*
        // TODO: DEBUG
        for(let x = 0; x < this.size.x; x++) {
            let z = 0
            this.mask[z * this.size.x + x] = cp
            z = this.size.z
            this.mask[z * this.size.x + x] = cp
        }
        
        for(let z = 0; z < this.size.z; z++) {
            let x = 0
            this.mask[z * this.size.x + x] = cp
            x = this.size.x
            this.mask[z * this.size.x + x] = cp
        }
        */

    }

    fillBlocks(maps, chunk, map, fill_blocks, calc_building_y) {
        super.fillBlocks(maps, chunk, map, fill_blocks, calc_building_y)
    }

    nextDirection() {
        return Math.floor(this.randoms.double() * 4)
    }

}