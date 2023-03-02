import { ClusterBuildingBase } from "./building_cluster_base.js";
import { BuildingBlocks } from "./building/building_blocks.js";
import { BuildingTemplate } from "./building_template.js";
import { impl as alea } from "../../../vendors/alea.js";
import { Vector } from "../../helpers.js";
import type { Biome } from "../biome3/biomes.js";

//
export class ClusterEndCity extends ClusterBuildingBase {

    constructor(clusterManager, addr : Vector, biome? : Biome) {

        super(clusterManager, addr)
        this.random = new alea('seed' + 'tes4') //tre ruzan tes0

        this.max_height = 1
        this.is_empty = this.coord.y < 0
        if (this.is_empty) {
            return
        }

        // используемые шаблоны структур
        this.templates = new Map()
        for (const schema_name of ['endcity_fat_tower_top','endcity_fat_tower_middle','endcity_fat_tower_base','endcity_second_roof','endcity_third_floor_hard','endcity_second_floor_hard', 'endcity_base_roof','endcity_tower_top','endcity_bridge_gentle_stairs','endcity_bridge_steep_stairs','endcity_bridge_piece','endcity_bridge_end','endcity_tower_piece','endcity_tower_base','endcity_third_roof','endcity_third_floor','endcity_second_floor', 'endcity_base_floor']) {
            const template = BuildingTemplate.fromSchema(schema_name, this.block_manager)
            template.meta.draw_natural_basement = false
            template.meta.air_column_from_basement = false
            this.templates.set(schema_name, template)
        }

        // абсолютная позиция внутри layer-а (в центре кластера, на высоте 87 блоков)
        this.start_coord = this.coord.clone().addScalarSelf(this.size.x / 2, 100, this.size.z / 2)

        this.pieces = []
        this.addCity(new Vector(0, 0, 0), 0, this.random)

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
        /*
        

        for(let i = 0; i < 10; i ++) {

            // выбираем рандомную структуру
            const template = templates[Math.floor(this.randoms.double() * templates.length)]

            // направление, куда повернута структура (0...3)
            // поворот всегда осуществляется вокруг точки двери
            const door_direction = i % 4 // Math.floor(this.randoms.double() * 4)

            // координата относительно стартовой точки
            const coord = new Vector(
                0, // Math.trunc(this.randoms.double() * 8) - 4, // рандомный сдвиг в сторону
                i * 5, // "рандомный" сдвиг по высоте относительно ABS_MY_Y
                0 // Math.trunc(this.randoms.double() * 8) - 4 // рандомный сдвиг в сторону
            )

            // создаем структуру из шаблона
            const building = new BuildingBlocks(
                this,
                this.randoms.double(),
                coord.clone(),
                coord.clone(),
                door_direction,
                null,
                template
            )

            // структура устанавливается на эту позицию своим левым передним углом
            building.movePosTo(coord, false)
            // const aabb = building.getRealAABB()

            this.appendBuilding(building)

        }
        */

        // создание маски, чтобы трава и деревья "расступились" вокруг структур
        this.makeNearMask()

        // let m = ''
        // for(let x = 0; x < this.size.x; x+=8) {
        //     for(let z = 0; z < this.size.z; z+=8) {
        //         const nidx = z * this.size.x + x
        //         let v = this.near_mask[nidx]
        //         m += (v == 255) ? '.' : '#'
        //     }
        //     m += '\n'
        // }
        // console.log(m)

    }

    /**
     * @param {BuildingBlocks} building 
     */
    appendBuilding(building) {
        const tp = new Vector(this.start_coord.x, 0, this.start_coord.z)
        building.translatePos(tp, false)
        building.setY(this.start_coord.y)
        building.addBlocks()
        this.buildings.set(building.coord, building)
    }

    /**
     * @param position 
     */
    addCity(position, rotation, rand) {
        let base = {
            pos: position,
            name: 'endcity_base_floor',
            rot: rotation,
            size: new Vector(10, 4, 10),
            overwrite: true
        }
        this.pieces.push(base)
        base = this.addChild(this.pieces, base, new Vector(0, 1, 0), "endcity_second_floor", rotation, false)
        base = this.addChild(this.pieces, base, new Vector(0, 4, 0), "endcity_third_floor", rotation, false)
        base = this.addChild(this.pieces, base, new Vector(0, 7, 0), "endcity_third_roof", rotation, false)
        this.addTower(1, base, null, rand)
    }

    /**
     * 
     * @param {*} pieces 
     * @param {*} previous 
     * @param {Vector} position 
     * @param {string} name 
     * @param {*} rotation 
     * @param {boolean} overwrite 
     * @returns 
     */
    addChild(pieces, previous, position, name, rotation, overwrite) {
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
        }
        pieces.push(piece)
        return piece
    }

    /**
     * 
     * @param {*} depth 
     * @param {*} current 
     * @param {*} position 
     * @param {*} pieces 
     * @param {*} rand 
     */

    addTower(depth, current, position, rand) {
        if (depth > 8) {
            return false
        }
        const rotation = current.rot
        let pieces = []
        let base = this.addChild(pieces, current, new Vector(3 + rand.nextInt(2), -3, 3 + rand.nextInt(2)), "endcity_tower_base", rotation, true)
        base = this.addChild(pieces, base, new Vector(0, 7, 0), "endcity_tower_piece", rotation, true)
        let floor = rand.nextInt(3) == 0 ? base : null
        const size = rand.nextInt(3) + 1
        for (let f = 0; f < size; f++) {
            base = this.addChild(pieces, base, new Vector(0, 4, 0), "endcity_tower_piece", rotation, true)
            if ((f < size - 1) && rand.nextBool()) {
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

    addFatTower(depth, current, position, rand) {
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

    addBridge(depth, current, position, rand) {
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

    addHouse(depth, current, position, rand) : boolean {
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