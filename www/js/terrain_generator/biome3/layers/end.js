import { impl as alea } from "../../../../vendors/alea.js";
import { AABB } from "../../../core/AABB.js";
import { Vector, VectorCollector } from "../../../helpers.js";
import { BuildingTemplate } from "../../cluster/building_template.js";

/**
 * Generate underworld infinity stones
 */
const xer = {"name":"floor_one","world":{"pos1":{"x":-262,"y":1,"z":1},"pos2":{"x":-269,"y":5,"z":-7},"entrance":{"x":-265,"y":1,"z":1}},"size":{"x":8,"y":5,"z":9},"door_pos":{"x":3,"y":0,"z":0},"blocks":[{"move":{"x":-3,"y":0,"z":1},"block_id":96},{"move":{"x":-3,"y":0,"z":2},"block_id":96},{"move":{"x":-3,"y":0,"z":3},"block_id":96},{"move":{"x":-3,"y":0,"z":4},"block_id":96},{"move":{"x":-3,"y":0,"z":5},"block_id":96},{"move":{"x":-3,"y":0,"z":6},"block_id":96},{"move":{"x":-3,"y":0,"z":7},"block_id":96},{"move":{"x":-3,"y":0,"z":8},"block_id":96},{"move":{"x":-3,"y":1,"z":1},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":-3,"y":1,"z":2},"block_id":68},{"move":{"x":-3,"y":1,"z":3},"block_id":68},{"move":{"x":-3,"y":1,"z":4},"block_id":68},{"move":{"x":-3,"y":1,"z":5},"block_id":68},{"move":{"x":-3,"y":1,"z":6},"block_id":68},{"move":{"x":-3,"y":1,"z":7},"block_id":68},{"move":{"x":-3,"y":1,"z":8},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":-3,"y":2,"z":1},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":-3,"y":2,"z":2},"block_id":68},{"move":{"x":-3,"y":2,"z":3},"block_id":480},{"move":{"x":-3,"y":2,"z":4},"block_id":68},{"move":{"x":-3,"y":2,"z":5},"block_id":68},{"move":{"x":-3,"y":2,"z":6},"block_id":480},{"move":{"x":-3,"y":2,"z":7},"block_id":68},{"move":{"x":-3,"y":2,"z":8},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":-3,"y":3,"z":1},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":-3,"y":3,"z":2},"block_id":68},{"move":{"x":-3,"y":3,"z":3},"block_id":480},{"move":{"x":-3,"y":3,"z":4},"block_id":68},{"move":{"x":-3,"y":3,"z":5},"block_id":68},{"move":{"x":-3,"y":3,"z":6},"block_id":480},{"move":{"x":-3,"y":3,"z":7},"block_id":68},{"move":{"x":-3,"y":3,"z":8},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":-2,"y":0,"z":0},"block_id":112,"extra_data":{"point":{"x":0.18322670445490985,"y":0,"z":0.16557782120457665}},"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":-2,"y":0,"z":1},"block_id":96},{"move":{"x":-2,"y":0,"z":2},"block_id":96},{"move":{"x":-2,"y":0,"z":3},"block_id":96},{"move":{"x":-2,"y":0,"z":4},"block_id":96},{"move":{"x":-2,"y":0,"z":5},"block_id":96},{"move":{"x":-2,"y":0,"z":6},"block_id":96},{"move":{"x":-2,"y":0,"z":7},"block_id":96},{"move":{"x":-2,"y":0,"z":8},"block_id":96},{"move":{"x":-2,"y":1,"z":1},"block_id":68},{"move":{"x":-2,"y":1,"z":8},"block_id":68},{"move":{"x":-2,"y":2,"z":1},"block_id":68},{"move":{"x":-2,"y":2,"z":8},"block_id":68},{"move":{"x":-2,"y":3,"z":1},"block_id":68},{"move":{"x":-2,"y":3,"z":8},"block_id":68},{"move":{"x":-1,"y":0,"z":0},"block_id":96},{"move":{"x":-1,"y":0,"z":1},"block_id":96},{"move":{"x":-1,"y":0,"z":2},"block_id":96},{"move":{"x":-1,"y":0,"z":3},"block_id":96},{"move":{"x":-1,"y":0,"z":4},"block_id":96},{"move":{"x":-1,"y":0,"z":5},"block_id":96},{"move":{"x":-1,"y":0,"z":6},"block_id":96},{"move":{"x":-1,"y":0,"z":7},"block_id":96},{"move":{"x":-1,"y":0,"z":8},"block_id":96},{"move":{"x":-1,"y":1,"z":1},"block_id":68},{"move":{"x":-1,"y":1,"z":8},"block_id":68},{"move":{"x":-1,"y":2,"z":1},"block_id":68},{"move":{"x":-1,"y":2,"z":8},"block_id":480},{"move":{"x":-1,"y":3,"z":1},"block_id":68},{"move":{"x":-1,"y":3,"z":8},"block_id":480},{"move":{"x":0,"y":0,"z":0},"block_id":96},{"move":{"x":0,"y":0,"z":1},"block_id":96},{"move":{"x":0,"y":0,"z":2},"block_id":96},{"move":{"x":0,"y":0,"z":3},"block_id":96},{"move":{"x":0,"y":0,"z":4},"block_id":96},{"move":{"x":0,"y":0,"z":5},"block_id":96},{"move":{"x":0,"y":0,"z":6},"block_id":96},{"move":{"x":0,"y":0,"z":7},"block_id":96},{"move":{"x":0,"y":0,"z":8},"block_id":96},{"move":{"x":0,"y":1,"z":8},"block_id":68},{"move":{"x":0,"y":2,"z":8},"block_id":68},{"move":{"x":0,"y":3,"z":8},"block_id":68},{"move":{"x":1,"y":0,"z":0},"block_id":96},{"move":{"x":1,"y":0,"z":1},"block_id":96},{"move":{"x":1,"y":0,"z":2},"block_id":96},{"move":{"x":1,"y":0,"z":3},"block_id":96},{"move":{"x":1,"y":0,"z":4},"block_id":96},{"move":{"x":1,"y":0,"z":5},"block_id":96},{"move":{"x":1,"y":0,"z":6},"block_id":96},{"move":{"x":1,"y":0,"z":7},"block_id":96},{"move":{"x":1,"y":0,"z":8},"block_id":96},{"move":{"x":1,"y":1,"z":8},"block_id":68},{"move":{"x":1,"y":2,"z":8},"block_id":68},{"move":{"x":1,"y":3,"z":8},"block_id":68},{"move":{"x":2,"y":0,"z":0},"block_id":96},{"move":{"x":2,"y":0,"z":1},"block_id":96},{"move":{"x":2,"y":0,"z":2},"block_id":96},{"move":{"x":2,"y":0,"z":3},"block_id":96},{"move":{"x":2,"y":0,"z":4},"block_id":96},{"move":{"x":2,"y":0,"z":5},"block_id":96},{"move":{"x":2,"y":0,"z":6},"block_id":96},{"move":{"x":2,"y":0,"z":7},"block_id":96},{"move":{"x":2,"y":0,"z":8},"block_id":96},{"move":{"x":2,"y":1,"z":1},"block_id":68},{"move":{"x":2,"y":1,"z":8},"block_id":68},{"move":{"x":2,"y":2,"z":1},"block_id":68},{"move":{"x":2,"y":2,"z":8},"block_id":480},{"move":{"x":2,"y":3,"z":1},"block_id":68},{"move":{"x":2,"y":3,"z":8},"block_id":480},{"move":{"x":3,"y":0,"z":0},"block_id":112,"extra_data":{"point":{"x":0.4332039289127465,"y":0.027812449730675315,"z":1.002}},"rotate":{"x":0,"y":0,"z":0}},{"move":{"x":3,"y":0,"z":1},"block_id":96},{"move":{"x":3,"y":0,"z":2},"block_id":96},{"move":{"x":3,"y":0,"z":3},"block_id":96},{"move":{"x":3,"y":0,"z":4},"block_id":96},{"move":{"x":3,"y":0,"z":5},"block_id":96},{"move":{"x":3,"y":0,"z":6},"block_id":96},{"move":{"x":3,"y":0,"z":7},"block_id":96},{"move":{"x":3,"y":0,"z":8},"block_id":96},{"move":{"x":3,"y":1,"z":1},"block_id":68},{"move":{"x":3,"y":1,"z":8},"block_id":68},{"move":{"x":3,"y":2,"z":1},"block_id":68},{"move":{"x":3,"y":2,"z":8},"block_id":68},{"move":{"x":3,"y":3,"z":1},"block_id":68},{"move":{"x":3,"y":3,"z":8},"block_id":68},{"move":{"x":4,"y":0,"z":1},"block_id":96},{"move":{"x":4,"y":0,"z":2},"block_id":96},{"move":{"x":4,"y":0,"z":3},"block_id":96},{"move":{"x":4,"y":0,"z":4},"block_id":96},{"move":{"x":4,"y":0,"z":5},"block_id":96},{"move":{"x":4,"y":0,"z":6},"block_id":96},{"move":{"x":4,"y":0,"z":7},"block_id":96},{"move":{"x":4,"y":0,"z":8},"block_id":96},{"move":{"x":4,"y":1,"z":1},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":4,"y":1,"z":2},"block_id":68},{"move":{"x":4,"y":1,"z":3},"block_id":68},{"move":{"x":4,"y":1,"z":4},"block_id":68},{"move":{"x":4,"y":1,"z":5},"block_id":68},{"move":{"x":4,"y":1,"z":6},"block_id":68},{"move":{"x":4,"y":1,"z":7},"block_id":68},{"move":{"x":4,"y":1,"z":8},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":4,"y":2,"z":1},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":4,"y":2,"z":2},"block_id":68},{"move":{"x":4,"y":2,"z":3},"block_id":480},{"move":{"x":4,"y":2,"z":4},"block_id":68},{"move":{"x":4,"y":2,"z":5},"block_id":68},{"move":{"x":4,"y":2,"z":6},"block_id":480},{"move":{"x":4,"y":2,"z":7},"block_id":68},{"move":{"x":4,"y":2,"z":8},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":4,"y":3,"z":1},"block_id":42,"rotate":{"x":0,"y":1,"z":0}},{"move":{"x":4,"y":3,"z":2},"block_id":68},{"move":{"x":4,"y":3,"z":3},"block_id":480},{"move":{"x":4,"y":3,"z":4},"block_id":68},{"move":{"x":4,"y":3,"z":5},"block_id":68},{"move":{"x":4,"y":3,"z":6},"block_id":480},{"move":{"x":4,"y":3,"z":7},"block_id":68},{"move":{"x":4,"y":3,"z":8},"block_id":42,"rotate":{"x":0,"y":1,"z":0}}],"rot":[],"fluids":[]}
const MAX_GEN_DEPTH = 8

class XZXer {
    constructor(fastRandom) {
        this.blocks = new VectorCollector()
        this.pieces = []
        this.x = -104
        this.y = 320 
        this.z = -36
    }
    // первая генерация
    start() {
        this.pieces.push({
            "name": "base_floor",
            'rot': 0,
            'pos': new Vector(0, 0, 0)
        })
    }

    // сделать прослойку, должно быть нормально
    test(chunk, x, y, z) {
        for (const piece of this.pieces) {
            const block = this.getBlock((chunk.coord.x + x) - this.x,(chunk.coord.y + y) - this.y, (chunk.coord.z + z) - this.z  )

           // if (chunk.coord.x + x == xer)
        }
    }

    getBlock(x, y, z) {
        for (const block of xer.blocks) {
            if (block.move.x == x && block.move.y == y && block.move.z == z) {
                return block.block_id
            }
        }
        return 0
    }
}

class Template {
    constructor(name, pos, rotation, overwrite) {
        this.name = name;
		this.pos = pos;
		this.rotation = rotation;
		this.overwrite = overwrite;
    }
}

class GeneratorCity {
    constructor(fastRandom) {
        this.nodes = new VectorCollector()
        this.random = new alea('tree')
    }

    add(x, y, z, name, rot) {
    
    }

    rndInt(n) {
        return (random.double() * n) | 0
    }

    // Add new node
    addNode(x, y, z, dir, type, n, shift = 0) {
        if (n > MAX_GEN_DEPTH) {
            return
        }
        this.nodes.set(new Vector(x, y, z), {dir:0, type: 'tower', shift: shift})
        if (this.random.double() > 0.8) {
            this.addNode(x + 1, y, z, 0, 'tower', n + 1, 5)
        }
        if (this.random.double() > 0.8) {
            this.addNode(x - 1, y, z, 0, 'tower', n + 1, 8)
        }
        if (this.random.double() > 0.8) {
            this.addNode(x, y, z+1, 0, 'tower', n + 1, 9)
        }
        if (this.random.double() > 0.8) {
            this.addNode(x, y, z - 1, 0, 'tower', n + 1, 10)
        }
    }

    towerGenerator() {

    }

    startHouse(x, y, z) {
        const pieces = []
        pieces.push({
            move: new Vector(0, 0, 0),
            type: '0' 
        })
        pieces.push({
            move: new Vector(0, 4, 0),
            type: '1' 
        })
        pieces.push({
            move: new Vector(0, 8, 0),
            type: '2' 
        })
        this.nodes.set(new Vector(x, y, z), {dir: 0, pieces: pieces})
    }

    chunk(chunk, seed, rnd) {
        const node = this.nodes.get(chunk.addr)
        if (node) {
            for (const piece of node.pieces) {
                if (piece.type == '0') {
                    this.genBox(chunk, 3 + piece.move.x, piece.move.y, 3 + piece.move.z, 8, 8)
                }
                if (piece.type == '1') {
                    this.genBox(chunk, 2 + piece.move.x, piece.move.y, 2 + piece.move.z, 10, 10)
                }
                if (piece.type == '2') {
                    this.genBox(chunk, 1 + piece.move.x, piece.move.y, 1 + piece.move.z, 12, 12)
                }
                //this.genBox(chunk, 1, 9 + node.shift, 1, 12, 12)
            }
            //this.genBox(chunk, 1, 9 + node.shift, 1, 12, 12)
            //this.genBox(chunk, 2, 5 + node.shift, 2, 10, 10)
            //this.genBox(chunk, 3, 1 + node.shift, 3, 8, 8)
        }
    }

    genBox(chunk, minX, minY, minZ, nX, nZ) {
        for (let x = minX; x < nX + minX; x++) {
            for (let z = minZ; z < nZ + minZ; z++) {
                this.setBlock(chunk, x, minY, z, {id:96})
            } 
        }
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY + 1; y < 4 + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if (x != minX && z != minZ && x != minX + nX - 1 && z != minZ + nZ - 1) {
                        continue
                    }
                    if ((x == minX || x == minX + nX - 1) && (z == minZ || z == minZ + nZ - 1))  {
                        this.setBlock(chunk, x, y, z, {id:42})
                    } else {
                        this.setBlock(chunk, x, y, z, {id:121})
                    }
                } 
            }
        }
    }

    genWell(chunk, minX, minY, minZ, nX, nY, nZ, block = {id : 0}, well = true) {
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY; y < 3 + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
                        if (well && (x != minX && z != minZ && z != (nZ + minZ - 1) && x != (nX + minX - 1))) {
                            continue
                        }
                        this.setBlock(chunk, x, y, z, block);
                    }
                }
            }
        }
    }

    setBlock(chunk, x, y, z, block_type, rotate, extra_data) {
        if (x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            const { tblocks } = chunk;
            tblocks.setBlockId(x, y, z, block_type.id);
            if(rotate || extra_data) {
                tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data);
            }
            if(BLOCK.TICKING_BLOCKS.has(block_type.id)) {
                chunk.addTickingBlock(chunk.coord.offset(x, y, z))
            }
        }
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
        this.city = new GeneratorCity(generator.fastRandom)
        //this.city.add(124, 280, -227, "base")
        //this.city.startHouse(8, 1, -14)
        this.clusterManager = generator.clusterManager

        const template       = BuildingTemplate.fromSchema('mine', this.block_manager)
        console.log(template)
    }

    generate(chunk, seed, rnd) {
        const BLOCK = this.generator.block_manager
        const { cx, cy, cz, cw, uint16View } = chunk.tblocks.dataChunk
        //if(chunk.addr.y < 0)  {
            
            
            const block_id = BLOCK.END_STONE.id
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    
                    for(let y = 0; y < chunk.size.y; y++) {
                        const n2 = this.noise2d((chunk.coord.x + x)/ 100, (chunk.coord.z + z)/100) * y * 0.08
                        const index = cx * x + cy * y + cz * z + cw
                        
                        //console.log(n2)
                        if (n2 > 1.4 && chunk.addr.y == 0)
                        uint16View[index] = block_id
                    }
                }
            }
        //}
        //this.city.chunk(chunk, seed, rnd)
        //this.genRoom(chunk, rnd)
        return this.generator.generateDefaultMap(chunk)

    }

    genRoom(chunk, rnd) {
        if (chunk.addr.x == 8 && chunk.addr.z == -14 && chunk.addr.y == 1) {
            this.genBox(chunk, 1, 9, 1, 12, 12)
            this.genBox(chunk, 2, 5, 2, 10, 10)
            this.genBox(chunk, 3, 1, 3, 8, 8)
        }
    }

    genBox(chunk, minX, minY, minZ, nX, nZ) {
        for (let x = minX; x < nX + minX; x++) {
            for (let z = minZ; z < nZ + minZ; z++) {
                this.setBlock(chunk, x, minY, z, {id:96})
            } 
        }
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY + 1; y < 4 + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if (x != minX && z != minZ && x != minX + nX - 1 && z != minZ + nZ - 1) {
                        continue
                    }
                    if ((x == minX || x == minX + nX - 1) && (z == minZ || z == minZ + nZ - 1))  {
                        this.setBlock(chunk, x, y, z, {id:42})
                    } else {
                        this.setBlock(chunk, x, y, z, {id:121})
                    }
                } 
            }
        }
    }

    genWell(chunk, minX, minY, minZ, nX, nY, nZ, block = {id : 0}, well = true) {
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY; y < 3 + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
                        if (well && (x != minX && z != minZ && z != (nZ + minZ - 1) && x != (nX + minX - 1))) {
                            continue
                        }
                        this.setBlock(chunk, x, y, z, block);
                    }
                }
            }
        }
    }

    setBlock(chunk, x, y, z, block_type, rotate, extra_data) {
        if (x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            const { tblocks } = chunk;
            tblocks.setBlockId(x, y, z, block_type.id);
            if(rotate || extra_data) {
                tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data);
            }
            if(BLOCK.TICKING_BLOCKS.has(block_type.id)) {
                chunk.addTickingBlock(chunk.coord.offset(x, y, z))
            }
        }
    }

}