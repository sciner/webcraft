import { ClusterBuildingBase } from "./building_cluster_base.js";
import { BuildingBlocks } from "./building/building_blocks.js";
import { BuildingTemplate } from "./building_template.js";
import { Vector } from "../../helpers.js";

//
export class ClusterEndCity extends ClusterBuildingBase {

    constructor(clusterManager, addr) {

        super(clusterManager, addr)

        this.max_height  = 1
        this.is_empty = this.coord.y < 0
        if(this.is_empty) {
            return
        }

        // используемые шаблоны структур
        const templates = []
        for(let schema_name of ['test2']) {
            const template = BuildingTemplate.fromSchema(schema_name, this.block_manager)
            template.meta.draw_natural_basement = false
            template.meta.air_column_from_basement = false
            templates.push(template)
        }

        // абсолютная позиция внутри layer-а (в центре кластера, на высоте 87 блоков)
        this.start_coord = this.coord.clone().addScalarSelf(this.size.x / 2, 87, this.size.z / 2)

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

}