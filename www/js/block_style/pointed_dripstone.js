import { DIRECTION, IndexedColor, Vector } from '../helpers.js';
import { BLOCK } from '../blocks.js';
import { AABB } from '../core/AABB.js';
import { TBlock } from '../typed_blocks3.js';
import { default as default_style } from './default.js';

const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0, 0, 0)));

// pointed_dripstone
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['pointed_dripstone'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const aabb = new AABB();
        aabb.set(0.25, 0, 0.25, 0.75, 1, 0.75);
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }
        
        const extra_data = block.extra_data;
        const material = block.material;
        const texture = getTexture(material, extra_data, neighbours);
        const planes = [];
        planes.push(...[
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [block.extra_data?.up ? 0 : Math.PI, block.extra_data?.up ? Math.PI / 4 : Math.PI * 5 / 4, 0]},
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [block.extra_data?.up ? 0 : Math.PI, block.extra_data?.up ? -Math.PI / 4 : Math.PI * 3 / 4, 0]}
        ]);
        const flag = 0;
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        for (const plane of planes) {
            default_style.pushPlane(vertices, {
                ...plane,
                lm:         lm,
                pos:        pos,
                matrix:     matrix,
                flag:       flag,
                texture:    [...texture]
            });
        }
    }

}

function getTexture(material, extra_data, neighbours) {
    const check = (n) => {
        if(neighbours[n].tb) {
            const next_neighbours = neighbours[n].tb.getNeighbours(neighbours[n], null, BLOCK_CACHE);
            return next_neighbours[n] && next_neighbours[n].id == BLOCK.POINTED_DRIPSTONE.id && ( (next_neighbours[n].extra_data.up == true && n == 'DOWN') || (next_neighbours[n].extra_data.up == false && n == 'UP'));
        }
        return false;
    };
    if (extra_data?.up) {
        if (neighbours.DOWN.id == BLOCK.AIR.id && neighbours.DOWN.fluid == 0) {
            return BLOCK.calcTexture(material.texture, DIRECTION.UP);
        }
        if (extra_data?.up && !neighbours.DOWN?.extra_data?.up) {
            return BLOCK.calcTexture(material.texture, DIRECTION.WEST);
        }
        if (neighbours.UP.id == BLOCK.DRIPSTONE_BLOCK.id) {
            if (check('DOWN')) {
                return BLOCK.calcTexture(material.texture, DIRECTION.DOWN);
            }
            return BLOCK.calcTexture(material.texture, DIRECTION.NORTH);
        }
        if (check('DOWN')) {
            return BLOCK.calcTexture(material.texture, DIRECTION.SOUTH);
        }
    }
    if (neighbours.UP.id == BLOCK.AIR.id && neighbours.UP.fluid == 0) {
        return BLOCK.calcTexture(material.texture, DIRECTION.UP);
    }
    if (!extra_data?.up && neighbours.UP?.extra_data?.up) {
        return BLOCK.calcTexture(material.texture, DIRECTION.WEST);
    }
    if (check('UP')) {
        return BLOCK.calcTexture(material.texture, DIRECTION.SOUTH);
    }
    return BLOCK.calcTexture(material.texture, DIRECTION.NORTH);
}