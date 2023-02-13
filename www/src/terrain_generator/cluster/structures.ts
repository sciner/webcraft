import { ClusterBuildingBase } from "./building_cluster_base.js";
import { BuildingBlocks } from "./building/building_blocks.js";
import { BuildingTemplate } from "./building_template.js";
import { Vector } from "../../helpers.js";

//
export class ClusterStructures extends ClusterBuildingBase {
    [key: string]: any;

    constructor(clusterManager, addr) {

        super(clusterManager, addr)

        this.max_height  = 1
        this.is_empty = false

        if(this.is_empty) {
            return
        }

        this.moveToRandomCorner()

        const bm = this.block_manager

        const schemas = [
            'structure1', 'structure2', 'mine', 'underearth_tower',
            'broken_castle', 'ornated_stone_tower_ruins',
            'structure3', 'structure4', 'structure5', 'structure6', 'small_lake'
        ]

        /**
         * @param {string} schema_name
         * @param {Vector} coord
         */
        const addStructure = (schema_name, coord, door_direction) => {

            // randoms
            const template       = BuildingTemplate.fromSchema(schema_name, bm)
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
            // const am = getAheadMove(door_direction).multiplyScalarSelf(16)
            // building.translateXZ(am)
            // building.moveXZTo(this.coord)

            this.buildings.set(building.coord, building)

        }

        if(this.randoms.double() < .333) {

            const coord = this.coord.clone().addScalarSelf(128, -10, 128)
            const door_direction = Math.floor(this.randoms.double() * 4)
            addStructure('house_dwarf', coord, door_direction)


        } else if(this.randoms.double() < .667) {

            const coord = this.coord.clone().addScalarSelf(128, 0, 128)
            const door_direction = Math.floor(this.randoms.double() * 4)
            addStructure('underearth_rooms', coord, door_direction)

        } else {

            for(let x = 32; x <= 224; x += 64) {
                for(let z = 32; z <= 224; z += 64) {
                    if(this.randoms.double() < .5) {

                        x += Math.round((this.randoms.double() + this.randoms.double()) * 10)
                        z += Math.round((this.randoms.double() + this.randoms.double()) * 10)

                        // randoms
                        const door_direction = Math.floor(this.randoms.double() * 4)
                        const schema_name = schemas[Math.floor(this.randoms.double() * schemas.length)]
                        const coord = this.coord.clone().addScalarSelf(x, 0, z)

                        // const aabb = building.getRealAABB()
                        // const am = getAheadMove(door_direction).multiplyScalarSelf(16)
                        // building.translateXZ(am)
                        // building.moveXZTo(this.coord)

                        addStructure(schema_name, coord, door_direction)

                    }
                }
            }

        }

        // If any structure added
        if(this.buildings.size > 0) {

            // Fill near_mask
            const margin = 3
            for(const building of this.buildings.values()) {
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