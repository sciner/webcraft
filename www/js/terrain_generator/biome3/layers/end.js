import { impl as alea } from "../../../../vendors/alea.js";
import { Vector, VectorCollector } from "../../../helpers.js";

/**
 * Generate underworld infinity stones
 */
const MAX_GEN_DEPTH = 8
class GeneratorCity {
    constructor(fastRandom) {
        this.nodes = new VectorCollector()
        this.random = new alea('tree');
    }

    add(x, y, z, type, rot) {
     
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
        //this.city = new GeneratorCity(generator.fastRandom)
        //this.city.add(124, 280, -227, "base")
        //this.city.startHouse(8, 1, -14)
        this.clusterManager = generator.clusterManager
        console.log(this.clusterManager)
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