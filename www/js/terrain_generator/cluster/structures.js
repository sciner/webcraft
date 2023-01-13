import { ClusterBuildingBase, getAheadMove } from "./building_cluster_base.js";
import { BLOCK } from "../../blocks.js";
import { BuildingBlocks } from "./building/building_blocks.js";
import { BuildingTemplate } from "./building_template.js";
import { Vector } from "../../helpers.js";

//
export class ClusterStructures extends ClusterBuildingBase {

    constructor(clusterManager, addr) {

        super(clusterManager, addr)

        this.max_height  = 1
        this.is_empty = false // !addr.equal(new Vector(-738, 0, -2139))

        if(this.is_empty) {
            return
        }

        this.moveToRandomCorner()

        const bm = BLOCK

        const schemas = [
            'structure1', 'structure2', 'mine', 'underearth_tower',
            'broken_castle', 'house_dwarf', 'ornated_stone_tower_ruins',
            'test2'
        ]

        // randoms
        const door_direction = Math.floor(this.randoms.double() * 4)
        const schema_name = 'domsmall' // schemas[Math.floor(this.randoms.double() * schemas.length)]

        const template       = BuildingTemplate.fromSchema(schema_name, bm)
        const coord          = this.coord.clone().addScalarSelf(128, 0, 128)

        for(let door_direction of [0, 1, 2, 3]) {

            const xz = coord.clone()

            const building = new BuildingBlocks(
                this,
                this.randoms.double(),
                xz,
                xz,
                door_direction,
                null,
                template
            )

            // const aabb = building.getRealAABB()
            const am = getAheadMove(door_direction).multiplyScalarSelf(16)
            building.translateXZ(am)
            // building.moveXZTo(this.coord)

            this.buildings.set(building.coord, building)

        }

        if(this.buildings.size > 0) {

            // Fill near_mask
            const margin = 3
            for(const [_, building] of this.buildings.entries()) {
                const pos = new Vector(building.aabb.x_min, 0, building.aabb.z_min)
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

}