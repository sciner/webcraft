import {Vector} from "../../www/js/helpers.js";
import {ServerClient} from "../../www/js/server_client.js";
import {Default_Terrain_Generator} from '../../www/js/terrain_generator/default.js';

export default class Ticker {

    static type = 'sapling'

    //
    static async func(world, chunk, v) {
        const tblock = v.tblock;
        const ticking = v.ticking;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        if(v.ticks % extra_data.max_ticks == 0) {
            const treeGenerator = await TreeGenerator.getInstance();
            const new_tree_blocks = await treeGenerator.generateTree(world, this.chunk, v.pos, tblock.convertToDBItem());
            if(new_tree_blocks) {
                updated_blocks.push(...new_tree_blocks);
                // Delete completed block from tickings
                this.delete(v.pos);
            }
        }
        if(!extra_data) {
            return;
        }
        return updated_blocks;
    }

}


// TreeGenerator
class TreeGenerator extends Default_Terrain_Generator {

    static _instance = null;

    constructor(seed, world_id) {
        super(seed, world_id);
    }

    static async getInstance() {
        if(TreeGenerator._instance) {
            return TreeGenerator._instance;
        }
        // Import trees
        await import('../../www/js/terrain_generator/biomes.js').then(module => {
            TreeGenerator.TREES = module.TREES;
        });
        // Return instance
        return TreeGenerator._instance = new TreeGenerator();
    }

    // Generate tree
    async generateTree(world, world_chunk, pos, m) {
        const updated_blocks    = [];
        const tree_style        = m.extra_data.style.toLowerCase();
        const tree_type         = TreeGenerator.TREES[tree_style.toUpperCase()];
        const _temp_vec         = new Vector(0, 0, 0);
        if(!tree_type) {
            throw 'error_invalid_tree_style';
        }
        //
        const getMaxFreeHeight = () => {
            let resp_max_height = 0;
            for(let y = 0; y <= tree_height; y++) {
                for(let x = -2; x <= 2; x++) {
                    for(let z = -2; z <= 2; z++) {
                        if(!(x == 0 && y == 0 && z == 0)) {
                            _temp_vec.copyFrom(pos);
                            _temp_vec.x += x;
                            _temp_vec.y += y;
                            _temp_vec.z += z;
                            let near_block = world.getBlock(_temp_vec);
                            if(!near_block) {
                                return -1;
                            }
                            if(near_block.id > 0 && ['leaves', 'plant', 'dirt'].indexOf(near_block.material.material.id) < 0) {
                                return resp_max_height;
                            }
                        }
                    }
                }
                resp_max_height++;
            }
            return resp_max_height;
        };
        //
        let tree_height = m.extra_data.height;
        let max_height = getMaxFreeHeight();
        if(max_height < 0) {
            return updated_blocks;
        }
        //
        if(max_height < tree_type.height.min) {
            console.error('not free space for sapling', tree_type, max_height);
            return updated_blocks;
        }
        tree_height = Math.min(tree_height, max_height);
        //
        const chunk = {
            coord: world_chunk.coord,
            tblocks: {
                get: function() {
                    return {id: 0};
                }
            }
        };
        //
        let is_invalid_operation = false;
        this.setBlock = function(chunk, x, y, z, block_type, force_replace, rotate, extra_data) {
            _temp_vec.set(x, y, z);
            let near_block = world.getBlock(_temp_vec);
            if(!near_block) {
                is_invalid_operation = true;
                return false;
            }
            if(near_block.id == 0 || near_block.material.material.id == 'leaves' || near_block.material.material.id == 'plant' || near_block.material.is_sapling) {
                updated_blocks.push({pos: new Vector(x, y, z), item: {id: block_type.id, extra_data: extra_data, rotate: rotate}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                return true;
            }
            return false;
        };
        this.plantTree({height: tree_height, type: {...tree_type, style: tree_style}}, chunk, pos.x, pos.y, pos.z, false);
        return is_invalid_operation ? [] : updated_blocks;
    }

}
