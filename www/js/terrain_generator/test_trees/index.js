import { IndexedColor, Vector } from '../../helpers.js';
import { Default_Terrain_Generator, alea, Default_Terrain_Map_Cell, Default_Terrain_Map } from '../default.js';
import { BLOCK } from '../../blocks.js';
import { TREES } from '../../terrain_generator/biomes.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Z } from '../../chunk_const.js';
import { createNoise2D, createNoise3D } from '../../../vendors/simplex-noise.js';

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS.clone();
const DEFAULT_WATER_COLOR = IndexedColor.WATER.clone();

export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(world, seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(seed);
        TREES.init();
    }

    async init() {}

    /**
     * @param {Vector} addr 
     * @returns 
     */
    calcTreeOptions(addr) {

        const aleaRandom = new alea(addr.toHash());
        const tree_types = Object.keys(TREES);
        const tree_type_index = Math.floor(aleaRandom.double() * tree_types.length);
        const tree_type_key = tree_types[tree_type_index];
        const tree_type = TREES[tree_type_key];
        const tree_height = Math.round(aleaRandom.double() * (tree_type.height.max - tree_type.height.min) + tree_type.height.min)

        return {tree_type, tree_height}
    }

    generate(chunk) {

        // setBlock
        const { cx, cy, cz, cw } = chunk.dataChunk;

        // setBlock
        const setBlock = (x, y, z, block_id) => {
            const index = cx * x + cy * y + cz * z + cw;
            chunk.tblocks.id[index] = block_id;
        };

        const aleaRandom = new alea(chunk.addr.toHash())
        const noiseRandom = new alea('tree_river')
        const noise2d = createNoise2D(noiseRandom.double);
        const random_blocks = [BLOCK.STONE.id, BLOCK.COBBLESTONE.id, BLOCK.ANDESITE.id, BLOCK.WHITE_TERRACOTTA.id, BLOCK.LIGHT_GRAY_CONCRETE_POWDER.id]
        const getRandBlock = () => {
            return random_blocks[(aleaRandom.double() * random_blocks.length) | 0]
        }
        const random_river_blocks = [BLOCK.GRAY_CONCRETE_POWDER.id, BLOCK.BASALT.id, BLOCK.GRAY_TERRACOTTA.id]
        const getRiverBlockId = () => {
            return random_river_blocks[(aleaRandom.double() * random_river_blocks.length) | 0]
        }
        const random_flowers = [BLOCK.DANDELION.id, BLOCK.RED_MUSHROOM.id, BLOCK.BROWN_MUSHROOM.id, BLOCK.LILY_OF_THE_VALLEY.id]
        const getFlowerBlockId = () => {
            return random_flowers[(aleaRandom.double() * random_flowers.length) | 0]
        }
        

        //
        const current_chunk_has_tree = chunk.addr.x % 2 == 0 && chunk.addr.z % 2 == 0
        const block_id = current_chunk_has_tree ? BLOCK.GRASS_BLOCK.id : null;

        if(chunk.addr.y == 0) {

            // рисование земли
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    for(let y = 0; y < 1; y++) {
                        let bid = block_id
                        if(bid) {
                            let r = aleaRandom.double()
                            if(r < .4) {
                                r /= .4
                                let grass_id = BLOCK.GRASS.id
                                if(r < .05) {
                                    grass_id = getFlowerBlockId()
                                }
                                setBlock(x, y + 1, z, grass_id);
                            }
                        } else {
                            const n = noise2d((chunk.coord.x + x) / 100, (chunk.coord.z + z) / 100) * .67 +
                            noise2d((chunk.coord.x + x) / 50, (chunk.coord.z + z) / 50) * .33
                            bid = Math.abs(n) < .03 ? getRiverBlockId() : getRandBlock()
                        }
                        setBlock(x, y, z, bid);
                    }
                }
            }

            // посадка деревьев
            if(current_chunk_has_tree) {

                const {tree_type, tree_height} = this.calcTreeOptions(chunk.addr);

                this.plantTree(
                    {
                        // рандомная высота дерева
                        height: tree_height,
                        type: tree_type
                    },
                    chunk,
                    // XYZ позиция в чанке
                    7, 1, 7
                );

            } else {

                for(let x = -1; x < 2; x++) {
                    for(let z = -1; z < 2; z++) {

                        const addr = chunk.addr.add(new Vector(x, 0, z));
                        const has_tree = addr.x % 2 == 0 && addr.z % 2 == 0;

                        if(has_tree) {

                            const {tree_type, tree_height} = this.calcTreeOptions(addr);

                            this.plantTree(
                                {
                                    // рандомная высота дерева
                                    height: tree_height,
                                    type: tree_type
                                },
                                chunk,
                                // XYZ позиция в чанке
                                7 + CHUNK_SIZE_X * x,
                                1,
                                7 + CHUNK_SIZE_Z * z
                            );

                        }

                    }
                }

            }

        }

        const cell = {
            dirt_color: DEFAULT_DIRT_COLOR,
            water_color: DEFAULT_WATER_COLOR,
            biome: new Default_Terrain_Map_Cell({
            code: 'flat'
        })};

        return new Default_Terrain_Map(
            chunk.addr,
            chunk.size,
            chunk.addr.mul(chunk.size),
            {WATER_LINE: 63},
            Array(chunk.size.x * chunk.size.z).fill(cell)
        );

    }

}