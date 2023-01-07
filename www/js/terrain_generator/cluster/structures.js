import { DIRECTION, getChunkAddr, Vector, VectorCollector} from "../../helpers.js";
import { ClusterBuildingBase } from "./building_cluster_base.js";
import { BuildingPalettes } from "./building/palette.js";
import { BLOCK } from "../../blocks.js";
import { BuildingBlocks } from "./building/building_blocks.js";
import { ClusterPoint } from "./base.js";

//
export class ClusterStructures extends ClusterBuildingBase {

    constructor(clusterManager, addr) {

        super(clusterManager, addr)

        this.max_height  = 1
        this.is_empty = false

        this.buildings = new VectorCollector()

        this.moveToRandomCorner()

        // Building palettes
        this.building_palettes = new BuildingPalettes(this, {
            crossroad: [],
            required: [],
            others: [
                {class: BuildingBlocks, max_count: Infinity, chance: 1, block_templates: ['structure1', 'structure2', 'mine', 'underearth_tower', 'broken_castle']}
            ]
        }, BLOCK)

        const cp = new ClusterPoint(20, 3, 2)

        //
        let x = 10 + Math.floor(this.randoms.double() * 80)
        let z = 40 + Math.floor(this.randoms.double() * 80)

        const size = new Vector(128, 5, 128)
        const entrance_pos = new Vector(x, Infinity, z)
        const door_bottom = new Vector(x, Infinity, z)
        const building = this.addBuilding(this.randoms.double(), x, z - size.z, size, entrance_pos, door_bottom, DIRECTION.NORTH)

        if(building) {

            /*

            // TODO: DEBUG

            // const chunkManager = this.clusterManager.chunkManager
            // const map_addr = getChunkAddr(building.coord)
            // const maps = chunkManager.world.generator.maps
            // const center_map = maps.generateAround({chunkManager}, map_addr, true, false)[4]

            const drawCol = (pos) => {
                const x = pos.x - this.coord.x
                const z = pos.z - this.coord.z
                this.mask[z * this.size.x + x] = new ClusterPoint(20, 3, 2)
            }

            drawCol(building.coord.clone())
            drawCol(building.coord.add(building.size))
            drawCol(building.coord.add(new Vector(building.size.x, 0, 0)))
            drawCol(building.coord.add(new Vector(0, 0, building.size.z)))
            */

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
        super.fillBlocks(maps, chunk, map, true, calc_building_y)
    }

    nextDirection() {
        return Math.floor(this.randoms.double() * 4)
    }

}