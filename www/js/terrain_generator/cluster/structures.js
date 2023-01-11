import { DIRECTION, Vector } from "../../helpers.js";
import { ClusterBuildingBase } from "./building_cluster_base.js";
import { BLOCK } from "../../blocks.js";
import { BuildingBlocks } from "./building/building_blocks.js";
import { BuildingTemplate } from "./building_template.js";

//
export class ClusterStructures extends ClusterBuildingBase {

    constructor(clusterManager, addr) {

        super(clusterManager, addr)

        this.max_height  = 1
        this.is_empty = !addr.equal(new Vector(-5261, 0, 7146))

        if(this.is_empty) {
            return
        }

        this.moveToRandomCorner()

        const bm = BLOCK

        /*
            'test', 'structure1', 'structure2', 'mine', 'underearth_tower',
            'broken_castle', 'house_dwarf', 'ornated_stone_tower_ruins'
        */

        for(let door_direction of [0, 1, 2, 3]) {

            const template       = BuildingTemplate.fromSchema('medium_house', bm) // medium_house mine
            const coord          = new Vector(-841664 + door_direction * 16, 0, 1143398)
            // const door_direction = DIRECTION.NORTH

            const building = new BuildingBlocks(
                this,
                this.randoms.double(),
                coord,
                coord,
                door_direction,
                null,
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