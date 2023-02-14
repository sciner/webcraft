import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import {Resources} from "../resources.js";
import { Vector } from '../helpers.js';
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';

Resources.loadPainting();

// Картина
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['painting'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(tblock : TBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {

        if(for_physic || !tblock) {
            return [];
        }

        const x     = 0;
        const y     = 0;
        const z     = 0;

        let width   = 1
        let height  = 2/16;
        let depth   = 1;

        // AABB
        let aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y + .5 - height/2,
            z + .5 - depth/2,
            x + .5 + width/2,
            y + .5 + height/2,
            z + .5 + depth/2
        );

        if(tblock.extra_data) {
            aabb.set(...tblock.extra_data.aabb as tupleFloat6)
                .translate(-tblock.posworld.x, -tblock.posworld.y, -tblock.posworld.z);
        }

        //
        if(!for_physic) {
            aabb.pad(1/500);
        }

        return [aabb];

    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const params = block.extra_data;
        if(!params) {
            // throw 'error_empty_painting_extra_data';
            return null;
        }

        const aabb = style.computeAABB(block, false)[0];
        aabb.pad(-1/500);
        aabb.translate(x, y, z);

        // Texture
        const c = [...block.material.texture.side];
        c.push(...[64/512, 64/512]);

        // Find image for painting
        const size_key = params.size.join('x');
        const col = Resources._painting.sizes.get(size_key);
        if(!col) {
            throw 'error_invalid_painting_size|' + size_key;
        }
        const texture_c = col.get(params.image_name);
        if(!texture_c) {
            throw 'error_invalid_painting_image|' + params.image_name;
        }

        const sides = {
            up:     new AABBSideParams(c, 0, 1, null, null, false),
            down:   new AABBSideParams(c, 0, 1, null, null, false),
            south:  new AABBSideParams([...c], 0, 1, null, null, false),
            north:  new AABBSideParams([...c], 0, 1, null, null, false),
            west:   new AABBSideParams([...c], 0, 1, null, null, false),
            east:   new AABBSideParams([...c], 0, 1, null, null, false),
        };

        sides.up.uv[2] = (aabb.width * 32) / 512;
        sides.up.uv[3] = (aabb.depth * 32) / 512;

        sides.north.uv[2] = sides.south.uv[2] = (aabb.width * 32) / 512;
        sides.north.uv[3] = sides.south.uv[3] = (aabb.height * 32) / 512;

        sides.west.uv[2] = sides.east.uv[2] = (aabb.depth * 32) / 512;
        sides.west.uv[3] = sides.east.uv[3] = (aabb.height * 32) / 512;

        if(params.pos_n.x > 0) {
            sides.east.uv[0] = texture_c.x + texture_c.w / 2;
            sides.east.uv[1] = texture_c.y + texture_c.h / 2;
            sides.east.uv[2] = texture_c.w;
            sides.east.uv[3] = texture_c.h;
        } else if(params.pos_n.x < 0) {
            sides.west.uv[0] = texture_c.x + texture_c.w / 2;
            sides.west.uv[1] = texture_c.y + texture_c.h / 2;
            sides.west.uv[2] = texture_c.w;
            sides.west.uv[3] = texture_c.h;
        } else if(params.pos_n.z > 0) {
            sides.north.uv[0] = texture_c.x + texture_c.w / 2;
            sides.north.uv[1] = texture_c.y + texture_c.h / 2;
            sides.north.uv[2] = texture_c.w;
            sides.north.uv[3] = texture_c.h;
        } else if(params.pos_n.z < 0) {
            sides.south.uv[0] = texture_c.x + texture_c.w / 2;
            sides.south.uv[1] = texture_c.y + texture_c.h / 2;
            sides.south.uv[2] = texture_c.w;
            sides.south.uv[3] = texture_c.h;
        }

        // Push vertices
        pushAABB(vertices, aabb, pivot, matrix, sides, new Vector(x, y, z));

        return null;

    }

}