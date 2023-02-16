import { ClusterBuildingBase } from "./building_cluster_base.js";
import { BuildingBlocks } from "./building/building_blocks.js";
import { BuildingTemplate } from "./building_template.js";
import { Vector } from "../../helpers.js";
import { impl as alea } from "../../../vendors/alea.js";
//
export class ClusterEndCity extends ClusterBuildingBase {

    constructor(clusterManager, addr) {

        super(clusterManager, addr)

        this.random = new alea('treee')

        this.max_height = 1
        this.is_empty = this.coord.y < 0
        if (this.is_empty) {
            return
        }

        // используемые шаблоны структур
        this.templates = new Map()
        for (const schema_name of ['endcity_bridge_piece','endcity_bridge_end','endcity_tower_piece', 'endcity_tower_base', 'endcity_base_floor', 'endcity_second_floor', 'endcity_third_floor', 'endcity_third_roof']) {
            const template = BuildingTemplate.fromSchema(schema_name, this.block_manager)
            template.meta.draw_natural_basement = false
            template.meta.air_column_from_basement = false
            this.templates.set(schema_name, template)
        }

        // абсолютная позиция внутри layer-а (в центре кластера, на высоте 87 блоков)
        this.start_coord = this.coord.clone().addScalarSelf(this.size.x / 2, 100, this.size.z / 2)

        this.pieces = []
        this.addCity(new Vector(0,0,0), 2, this.random)

        // мой дикий код
        /*this.pieces = []
        let base = {
            pos: new Vector(0, 0, 0),
            name: 'endcity_base_floor',
            rot: 0,
            overwrite: true
        }
        this.pieces.push(base)
        base = this.add(base, new Vector(0, 4, 0), "endcity_base_floor", 1, false)
        base = this.add(base, new Vector(0, 4, 0), "endcity_base_floor", 2, false)
        //base = this.add(base, new Vector(0, 0, 0), "endcity_second_floor", 0, false)
        //base = this.add(base, new Vector(0, 4, 0), "endcity_third_floor", 0, false)
        //base = this.add(base, new Vector(0, 8, 0), "endcity_third_roof", 0, false)

        //this.genTower(1, base, null)
*/
        for (const piece of this.pieces) {
            const template = this.templates.get(piece.name)
            const coord = piece.pos
            console.log(piece)
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

    genTower(depth, current, pos) {
        if (depth > 8) {
            return
        }
        const rotation = current.rot || 0
        let base = this.add(current, new Vector(3 + this.random.nextInt(2), -3, 3 + this.random.nextInt(2)), "endcity_tower_base", rotation, true)
        base = this.add(base, new Vector(0, 7, 0), "endcity_tower_piece", rotation, true)
        let currentFloor = this.random.nextInt(3) == 0 ? base : null;
        const size = this.random.nextInt(3) + 1;
        for (let floor = 0; floor < size; floor++) {
            base = this.add(base, new Vector(0, 4, 0), "endcity_tower_piece", rotation, true);
            if ((floor < size - 1) && (this.random.double() > 0.5)) {
                currentFloor = base;
            }
        }
    }

    add(previous, pos, name, rot, overwrite) {
        const test = {
            pos: pos.add(previous.pos),
            name: name,
            rot: rot,
            overwrite: overwrite
        }
        this.pieces.push(test)
        return test
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
        base = this.addChild(this.pieces, base, new Vector(0, 0, -1), "endcity_second_floor", rotation, false)
        base = this.addChild(this.pieces, base, new Vector(0, 4, -1), "endcity_third_floor", rotation, false)
        base = this.addChild(this.pieces, base, new Vector(0, 8, -1), "endcity_third_roof", rotation, false)
       // this.addTower(1, base, null, rand)
    }

    addTest(position, rotation, rand) {
        let base = {
            pos: position,
            name: 'endcity_base_floor',
            rot: rotation,
            size: new Vector(10, 4, 10),
            overwrite: true
        }
        pieces.push(base)
        base = this.addChild(this.pieces, base, new Vector(0, 4, 0), "endcity_base_floor", 1, false)
        base = this.addChild(this.pieces, base, new Vector(0, 4, 0), "endcity_second_floor", 1, false)
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
        const template = this.templates.get(name)
        const piece = {
            pos: position.add(previous.pos),
            name: name,
            rot: rotation % 4,
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
        const tower_bridges =[new Vector(0, -5, 5), new Vector(0, -1, 0)]
        if (depth > 8) {
            return
        }
        const rotation = current.rot
        let pieces = []
        let base = this.addChild(pieces, current, new Vector(3 + rand.nextInt(2), -3, 3 + rand.nextInt(2)), "endcity_tower_base", rotation, true)
        base = this.addChild(pieces, base, new Vector(0, 7, 0), "endcity_tower_piece", rotation, true)
        let floor = rand.nextInt(3) == 0 ? base : null;
        const size = rand.nextInt(3) + 1;
        for (let floor = 0; floor < size; floor++) {
            base = this.addChild(pieces, base, new Vector(0, 4, 0), "endcity_tower_piece", rotation, true)
            if ((floor < size - 1) && (rand.double() > 0.5)) {
                floor = base
            }
        }
        if (floor) {
            for (let i in tower_bridges) {
                const bridge = this.addChild(pieces, base, tower_bridges[i], "endcity_bridge_end", i, true)
                this.addBridge(depth + 1, bridge, null, rand)
            }
        } else {
            
        }
        this.pieces = this.pieces.concat(pieces)
    }

    addBridge(depth, current, position, rand) {
        if (depth > 8) {
            return
        }
        const rotation = current.rot
        let pieces = []
        let base = this.addChild(pieces, current, new Vector(0, 0, -4), "endcity_bridge_piece", rotation, true)
        this.pieces = this.pieces.concat(pieces)
    }

}