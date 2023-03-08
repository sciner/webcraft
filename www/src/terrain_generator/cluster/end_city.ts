import { ClusterBuildingBase } from "./building_cluster_base.js";
import { BuildingTemplate } from "./building_template.js";
import { impl as alea } from "../../../vendors/alea.js";
import { ArrayHelpers, Vector, VectorCollector } from "../../helpers.js";
import { BuildingBlocks } from "./building/building_blocks.js";
import { BlockDrawer } from "./block_drawer.js";

import type { Biome } from "../biome3/biomes.js";
import type { ClusterManager } from "./manager.js";
import type { TerrainMap, TerrainMapManager } from "../terrain_map.js";
import type { ChunkWorkerChunk } from "../../worker/chunk.js";

const MAX_FIND_RADIUS = 40

const CITY_BUILDING_SCHEMAS = [
    'endcity_fat_tower_top',
    'endcity_fat_tower_middle',
    'endcity_fat_tower_base',
    'endcity_second_roof',
    'endcity_third_floor_hard',
    'endcity_second_floor_hard',
    'endcity_base_roof',
    'endcity_tower_top',
    'endcity_bridge_gentle_stairs',
    'endcity_bridge_steep_stairs',
    'endcity_bridge_piece',
    'endcity_bridge_end',
    'endcity_tower_piece',
    'endcity_tower_base',
    'endcity_third_roof',
    'endcity_third_floor',
    'endcity_second_floor',
    'endcity_base_floor'
]

interface BuildingPiece {
    pos: Vector
    name: string
    rot: int
    size: any
    overwrite: boolean
}

//
export class ClusterEndCity extends ClusterBuildingBase {

    chunks = new VectorCollector()
    blocks = new BlockDrawer()
    max_height = 1
    templates = new Map()
    pieces = []

    constructor(clusterManager : ClusterManager, addr : Vector, biome? : Biome) {

        super(clusterManager, addr)
    
        this.is_empty = !((this.coord.z % 1024) == 0 && (this.coord.x % 1024) == 0)
        if (this.is_empty) {
            return
        }
        
        // находим место с максимальной высотой
        const size_half_x = this.size.x / 2
        const size_half_z = this.size.z / 2
        let max_noise = 1
        let sh_x = 0
        let sh_z = 0
        for (let x = -MAX_FIND_RADIUS; x < MAX_FIND_RADIUS; x++) {
            for (let z = -MAX_FIND_RADIUS; z < MAX_FIND_RADIUS; z++) {
                const noise = this.generator.noise2d((this.coord.x + size_half_x + x) / 100, (this.coord.z + size_half_z + z) / 100)
                if (noise < max_noise) {
                    max_noise = noise
                    sh_x = x
                    sh_z = z
                }
            }
        }

        this.random = new alea('seed' + this.generator.seed + 'x' + this.coord.x + 'z' + this.coord.z)

        // используемые шаблоны структур
        for (const schema_name of CITY_BUILDING_SCHEMAS) {
            const template = BuildingTemplate.fromSchema(schema_name, this.block_manager)
            this.templates.set(schema_name, template)
        }

        this.start_coord = this.coord.clone().addScalarSelf(size_half_x + sh_x, 39, size_half_z + sh_z)

        this.addCity(new Vector(0, 0, 0), 0, this.random)

        ArrayHelpers.shuffle(this.pieces, this.random.double)

        for (const piece of this.pieces) {
            const template = this.templates.get(piece.name)
            const coord = piece.pos
            const building = new BuildingBlocks(
                this,
                this.randoms.double(),
                coord.clone(),
                coord.clone(),
                piece.rot,
                null,
                template
            )
            this.appendBuilding(building)
        }
    }

    /**
     * Fill chunk blocks
     */
    fillBlocks(maps : TerrainMapManager, chunk : ChunkWorkerChunk, map : TerrainMap, fill_blocks : boolean = true, calc_building_y : boolean = true) {
        if(this.is_empty) {
            return false;
        }
        this.timers.start('fill_blocks')
        // set blocks list for chunk
        this.blocks.list = this.chunks.get(chunk.addr) ?? []
        // draw chunk blocks
        this.blocks.draw(this, chunk, map)
        this.timers.stop()
        this.timers.count++;
    }

    appendBuilding(building : BuildingBlocks) {
        const tp = new Vector(this.start_coord.x, 0, this.start_coord.z)
        building.translate(tp)
        building.setY(this.start_coord.y)
        building.addBlocks(this)
        this.buildings.set(building.coord, building)
    }

    addCity(position : Vector, rotation : int, rand : alea) {
        let base = {
            pos: position,
            name: 'endcity_base_floor',
            rot: rotation,
            size: new Vector(10, 4, 10),
            overwrite: true
        } as BuildingPiece
        this.pieces.push(base)
        base = this.addChild(this.pieces, base, new Vector(0, 1, 0), "endcity_second_floor", rotation, false)
        base = this.addChild(this.pieces, base, new Vector(0, 4, 0), "endcity_third_floor", rotation, false)
        base = this.addChild(this.pieces, base, new Vector(0, 7, 0), "endcity_third_roof", rotation, false)
        this.addTower(1, base, null, rand)
    }

    addChild(pieces : any, previous : any, position : Vector, name : string, rotation : int, overwrite : boolean) : any {
        const rot = rotation % 4
        const pos = new Vector(position.x, position.y, position.z)
        if (rot == 1) {
            pos.x = -position.z
            pos.z = position.x
        } else if (rot == 2) {
            pos.z = -position.z
            pos.x = position.x
        } else if (rot == 3) {
            pos.x = position.z
            pos.z = position.x
        }
        const template = this.templates.get(name)
        const piece = {
            pos: pos.add(previous.pos),
            name: name,
            rot: rot,
            size: template.size,
            overwrite: overwrite
        } as BuildingPiece
        pieces.push(piece)
        return piece
    }

    addTower(depth : int, current : BuildingPiece, position, rand : alea) {
        if (depth > 8) {
            return false
        }
        const rotation = current.rot
        let pieces = []
        let base = this.addChild(pieces, current, new Vector(3 + rand.nextInt(2), -3, 3 + rand.nextInt(2)), "endcity_tower_base", rotation, true)
        base = this.addChild(pieces, base, new Vector(0, 7, 0), "endcity_tower_piece", rotation, true)
        let floor = rand.nextInt(3) == 0 ? base : null
        const size = rand.nextInt(3) + 1
        for (let i = 0; i < size; i++) {
            base = this.addChild(pieces, base, new Vector(0, 4, 0), "endcity_tower_piece", rotation, true)
            if ((i < size - 1) && rand.nextBool()) {
                floor = base
            }
        }
        if (floor) {
            for (let rot = 0; rot < 4; rot++) {
                if (rand.nextBool()) {
                    const bridge = this.addChild(pieces, floor, new Vector(0, -1, 2), "endcity_bridge_end", rot + rotation, true)
                    this.addBridge(depth + 1, bridge, null, rand)
                }
            }
        } else {
            if (this.addFatTower(depth + 1, base, null, rand)) {
                this.pieces = this.pieces.concat(pieces)
                return true
            }
        }
        this.addChild(pieces, base, new Vector(0, 4, 0), "endcity_tower_top", rotation, true)
        this.pieces = this.pieces.concat(pieces)
        return true
    }

    addFatTower(depth : int, current : BuildingPiece, position? : Vector, rand? : alea) {
        if (depth > 8) {
            return false
        }
        const rotation = current.rot
        const pieces = []
        let base = this.addChild(pieces, current, new Vector(0, 3, 0), "endcity_fat_tower_base", rotation, true)
        base = this.addChild(pieces, base, new Vector(0, 4, 0), "endcity_fat_tower_middle", rotation, true)
        for(let floor = 0; floor < 2 && rand.nextInt(3) != 0; floor++) {
            base = this.addChild(pieces, base, new Vector(0, 8, 0), "endcity_fat_tower_middle", rotation, true);
            for (let rot = 0; rot < 4; rot++) {
                if (rand.nextBool()) {
                    const bridge = this.addChild(pieces, base, new Vector(0, -1, 5), "endcity_bridge_end", rot + rotation, true)
                    this.addBridge(depth + 1, bridge, null, rand)
                }
            }
        }
        this.addChild(pieces, base, new Vector(0, 8, 0), "endcity_fat_tower_top", rotation, true)
        this.pieces = this.pieces.concat(pieces)
        return true
    }

    addBridge(depth : int, current : BuildingPiece, position? : Vector, rand? : alea) {
        if (depth > 8) {
            return
        }
        const size = rand.nextInt(4) + 1
        const rotation = current.rot
        const pieces = []
        let base = this.addChild(pieces, current, new Vector(0, 0, 5), "endcity_bridge_piece", rotation, true)
        let y = 0
        for (let floor = 0; floor < size; floor++) {
            if (rand.nextBool()) {
                base = this.addChild(pieces, base, new Vector(0, y, 4), "endcity_bridge_piece", rotation, true)
                y = 0
            } else {
                if (rand.nextBool()) {
                    base = this.addChild(pieces, base, new Vector(0, y, 4), "endcity_bridge_steep_stairs", rotation, true)
                } else {
                    base = this.addChild(pieces, base, new Vector(0, y, 8), "endcity_bridge_gentle_stairs", rotation, true)
                }
                y = 4
            }
        }
        if (!this.addHouse(depth + 1, base, new Vector(0, y + 1, 5), rand)) {

        }
        this.pieces = this.pieces.concat(pieces)
    }

    addHouse(depth : int, current : BuildingPiece, position : Vector, rand : alea) : boolean {
        if (depth > 8) {
            return false
        }
        const pieces = []
        const rotation = current.rot
        const size = rand.nextInt(3)
        let base = this.addChild(pieces, current, position, "endcity_base_floor", rotation, true)
        if(size == 0) {
            this.addChild(this.pieces, base, new Vector(0, 4, 0), "endcity_base_roof", rotation, true)
        } else if(size == 1) {
            base = this.addChild(this.pieces, base, new Vector(0, 1, 0), "endcity_second_floor_hard", rotation, false)
            base = this.addChild(this.pieces, base, new Vector(0, 7, 0), "endcity_second_roof", rotation, false)
        } else {
            base = this.addChild(this.pieces, base, new Vector(0, 1, 0), "endcity_second_floor_hard", rotation, false)
            base = this.addChild(this.pieces, base, new Vector(0, 3, 0), "endcity_third_floor_hard", rotation, false)
            base = this.addChild(this.pieces, base, new Vector(0, 8, 0), "endcity_third_roof", rotation, false)
            this.addTower(depth + 1, base, null, rand)
        }
        this.pieces = this.pieces.concat(pieces)
        return true
    }

}