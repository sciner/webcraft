import { ClusterBuildingBase } from "./building_cluster_base.js";
import { BuildingBlocks } from "./building/building_blocks.js";
import { BuildingTemplate } from "./building_template.js";
import { Vector } from "../../helpers.js";
import type { ClusterManager } from "./manager.js";
import type { Biome } from "../biome3/biomes.js";
import { TerrainMapManager3 } from "../biome3/terrain/manager.js";
import { CANYON } from "../default.js";

export declare type IStructureList = {
    chance: float,
    schemas: string[],
    is_big? : boolean,
    move? : Vector // used for is_big structures
}[]

const DEFAULT_STRUCTURE_LIST = [
    {chance: .166, schemas: ['house_dwarf'], is_big: true, move: new Vector(128, -10, 128)},
    {chance: .333, schemas: ['jungle_temple'], is_big: true, move: new Vector(128, 0, 128)},
    {chance: .667, schemas: ['underearth_rooms'], is_big: true, move: new Vector(128, 0, 128)},
    {chance: 1, schemas: [
        'structure1', 'structure2', 'mine', 'underearth_tower',
        'broken_castle', 'ornated_stone_tower_ruins',
        'structure3', 'structure4', 'structure5', 'structure6', 'small_lake', 'temple1'
    ]},
]

//
export class ClusterStructures extends ClusterBuildingBase {

    constructor(clusterManager : ClusterManager, addr : Vector, biome : Biome, structure_list? : IStructureList) {

        super(clusterManager, addr)

        this.max_height  = 1
        this.is_empty = false

        this.moveToRandomCorner()
        this.initStructureList(structure_list ?? DEFAULT_STRUCTURE_LIST)
        this.fillMask()

    }

    initStructureList(structure_list : IStructureList) {

        const r = this.randoms.double()
        let structures = null
        for(let i = 0; i < structure_list.length; i++) {
            const item = structure_list[i]
            if(r < item.chance) {
                structures = item
                break
            }
        }

        if(!structures) {
            throw 'error_empty_structures'
        }

        if(structures.is_big) {

            const schemas = structures.schemas

            if(schemas.length != 1) {
                throw 'error_structures_schemas_only_can_be_one'
            }
            const coord = this.coord.clone()
            if(structures.move) {
                coord.addScalarSelf(structures.move.x, structures.move.y, structures.move.z)
            }
            const door_direction = Math.floor(this.randoms.double() * 4)
            this.addStructure(schemas[0], coord, door_direction)

        } else {

            const schemas = structures.schemas

            for(let x = 32; x <= 224; x += 64) {
                for(let z = 32; z <= 224; z += 64) {
                    if(this.randoms.double() < .5) {
                        x += Math.round((this.randoms.double() + this.randoms.double()) * 10)
                        z += Math.round((this.randoms.double() + this.randoms.double()) * 10)
                        // randoms
                        const door_direction = Math.floor(this.randoms.double() * 4)
                        const schema_name = schemas[Math.floor(this.randoms.double() * schemas.length)]
                        const coord = this.coord.clone().addScalarSelf(x, 0, z)
                        this.addStructure(schema_name, coord, door_direction)
                    }
                }
            }

        }

    }

    addStructure(schema_name : string, coord : Vector, door_direction : int) : BuildingBlocks | null {
        const bm = this.block_manager
        const template = BuildingTemplate.fromSchema(schema_name, bm)
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
        //
        if(this.clusterManager.layer.maps instanceof TerrainMapManager3) {
            // Не ставим структуры внутри или вблизи каньонов
            // TODO: Нужно сделать проверку по всем 4-м углам структуры, а не только по одному
            const mm = this.clusterManager.layer.maps as TerrainMapManager3
            const simplified_cell = mm.makeSimplifiedCell(coord)
            if(simplified_cell.canyon_point > -CANYON.STRUCTURE_DIST && simplified_cell.canyon_point < CANYON.STRUCTURE_DIST) {
                return null
            }
        }
        //
        // const aabb = building.getRealAABB()
        // const am = getAheadMove(door_direction).multiplyScalarSelf(16)
        // building.translate(am)
        // building.movePosTo(this.coord)
        this.buildings.set(building.coord, building)
        return building
    }

    fillMask() {
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