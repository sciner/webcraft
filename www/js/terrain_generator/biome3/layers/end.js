import { impl as alea } from "../../../../vendors/alea.js";
import { AABB } from "../../../core/AABB.js";
import { Vector, VectorCollector } from "../../../helpers.js";
import { BuildingTemplate } from "../../cluster/building_template.js";

/**
 * Generate underworld infinity stones
 */
const MAX_GEN_DEPTH = 8
/*
Суть идеи. Хочу просто пока написать рандомную генерацию города енда
То есть пока просто кубы любых блоков (размер "блока" блоков) указан в size, позже хочу передавть имена
струкутур
Нет места вывода, как выводить в мир блоки
*/
class Test {
    constructor(chunk) {
        this.random = new alea('tree')
        this.pieces = []
        if (chunk.addr.x == -7 && chunk.addr.y == 1 && chunk.addr.z == -3) {
            this.start()
        }
    }

    start() {
        let base = {
            pos: new Vector(1, 1, 1),
            name: 'test',
            rot: 0,
            size: new Vector(10, 4, 10),
            overwrite: true
        }
        this.pieces.push(base)
        base = this.add(base, new Vector(-1, 0, -1), "test", 0, new Vector(12, 8, 12), false)
        base = this.add(base, new Vector(-1, 4, -1), "test", 0, new Vector(14, 8, 14), false)
		base = this.add(base, new Vector(-1, 8, -1), "test", 0, new Vector(16, 2, 16), true)
        
        this.genTower(1, base, null)

        console.log(this.pieces)
    }

    genTower(depth, current, pos) {
        if (depth > 8) {
            return
        }
        const rotation = current.rot || 0
        let base = this.add(current, new Vector(3 + this.random.nextInt(2), -3, 3 + this.random.nextInt(2)), "test", rotation, new Vector(13, 4, 13), true)
        base = this.add(base, new Vector(0, 7, 0), "test", rotation, new Vector(7, 4, 7), true)
        let currentFloor = this.random.nextInt(3) == 0 ? base : null
        const size = this.random.nextInt(3) + 1
        for(let floor = 0; floor < size; floor++) {
            base = this.add(base, new Vector(0, 4, 0), "test", rotation, new Vector(7, 4, 7, true))
            if((floor < size - 1) && (this.random.double() > 0.5)) {
                currentFloor = base;
            }
        }
    }

    add(previous, pos, name, rot, size, overwrite) {
        const test = {
            pos: pos.add(previous.pos),
            name: name,
            rot: rot,
            size: size,
            overwrite: overwrite
        }
		this.pieces.push(test)
		return test
	}
}

export default class Biome3LayerEnd {

    /**
     * @param { import("../index.js").Terrain_Generator } generator
     */
    constructor(generator) {

        this.generator = generator

        this.noise2d = generator.noise2d
        this.noise3d = generator.noise3d
        this.block_manager = generator.block_manager
        this.clusterManager = generator.clusterManager

        //const template       = BuildingTemplate.fromSchema('mine', this.block_manager) !!! не работает
        //console.log(template)
    }

    generate(chunk, seed, rnd) {
        new Test(chunk) // Тестовый класс
        const BLOCK = this.generator.block_manager
        const { cx, cy, cz, cw, uint16View } = chunk.tblocks.dataChunk
        const block_id = BLOCK.END_STONE.id
        for (let x = 0; x < chunk.size.x; x++) {
            for (let z = 0; z < chunk.size.z; z++) {
                for (let y = 0; y < chunk.size.y; y++) {
                    const n2 = this.noise2d((chunk.coord.x + x) / 100, (chunk.coord.z + z) / 100) * y * 0.08
                    const index = cx * x + cy * y + cz * z + cw
                    if (n2 > 1.4 && chunk.addr.y == 0) {
                        uint16View[index] = block_id
                    }
                }
            }
        }
        return this.generator.generateDefaultMap(chunk)
    }

}