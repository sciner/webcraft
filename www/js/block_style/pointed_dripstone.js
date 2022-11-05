import { DIRECTION, QUAD_FLAGS, IndexedColor, Vector } from '../helpers.js';
import { BLOCK } from '../blocks.js';
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';

//const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0, 0, 0)));

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
        aabb.set(0, 0, 0, 1, 1, 1);
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }
        
        const extra_data = block.extra_data;
        const material = block.material;
        //north перед толщиной
        //south толстый
        let texture = BLOCK.calcTexture(material.texture, DIRECTION.NORTH);
        if (extra_data?.up) {
            if (neighbours.DOWN.id == BLOCK.AIR.id && neighbours.DOWN.fluid == 0) {
                texture = BLOCK.calcTexture(material.texture, DIRECTION.UP);
            } else if (neighbours.DOWN.id == BLOCK.POINTED_DRIPSTONE.id) { 
                if (neighbours.DOWN?.extra_data?.up) {
                    
                } else {
                    texture = BLOCK.calcTexture(material.texture, DIRECTION.WEST);
                }
            }
           // if (neighbours.DOWN.id == BLOCK.POINTED_DRIPSTONE.id && neighbours.DOWN.extra_data.up == false) {
            //    texture = BLOCK.calcTexture(material.texture, DIRECTION.WEST);
            //}
            //if (neighbours.DOWN.id == BLOCK.POINTED_DRIPSTONE.id && neighbours.UP.id == BLOCK.POINTED_DRIPSTONE.id && neighbours.DOWN.extra_data?.up && neighbours.UP.extra_data?.up) {
           //     texture = BLOCK.calcTexture(material.texture, DIRECTION.SOUTH);
           // }
        }
        
        //let texture = BLOCK.calcTexture(material.texture, DIRECTION.NORTH);
        //if (neighbours.UP.id != BLOCK.AIR.id && neighbours.UP.id != BLOCK.POINTED_DRIPSTONE.id) {
          //  texture = BLOCK.calcTexture(material.texture,  (neighbours.DOWN.id == BLOCK.POINTED_DRIPSTONE.id) ? DIRECTION.DOWN : DIRECTION.UP);
       // }
        //if (neighbours.UP.id == BLOCK.POINTED_DRIPSTONE.id && neighbours.DOWN.id == BLOCK.POINTED_DRIPSTONE.id) {
         //   texture = BLOCK.calcTexture(material.texture, DIRECTION.SOUTH);
       // }
        //if (neighbours.UP.id == BLOCK.POINTED_DRIPSTONE.id && neighbours.DOWN.id == BLOCK.AIR.id) {
        //    texture = BLOCK.calcTexture(material.texture, DIRECTION.NORTH);
        //}
        
        const planes = [];
        planes.push(...[
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 4, 0]},
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -Math.PI / 4, 0]}
        ]);
        const flag = 0;
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        for(const plane of planes) {
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