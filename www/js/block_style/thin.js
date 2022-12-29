import {DIRECTION, IndexedColor, NORMALS, QUAD_FLAGS, ROTATE} from '../helpers.js';
import {BLOCK, shapePivot} from "../blocks.js";
import { CubeSym } from '../core/CubeSym.js';
import { WorldPortal } from '../portal.js';
import { TBlock } from '../typed_blocks3.js';
import { AABB } from '../core/AABB.js';

// Панель
export default class style {

    static getRegInfo() {
        return {
            styles: ['thin'],
            aabb: style.computeAABB,
            func: this.func
        };
    }

    /**
     * @param {TBlock} tblock 
     * @param {boolean} for_physic 
     * @param {*} world 
     * @param {*} neighbours 
     * @param {boolean} expanded 
     */
    static computeAABB(tblock, for_physic, world, neighbours, expanded) {
        const shapes = [] // x1 y1 z1 x2 y2 z2
        const material = tblock.material
        // F R B L
        if(!(material.is_portal && for_physic)) {
            let cardinal_direction = tblock.getCardinalDirection()
            if(cardinal_direction == CubeSym.ROT_X) {
                cardinal_direction = ROTATE.E
            } if(cardinal_direction == CubeSym.ROT_Z) {
                cardinal_direction = ROTATE.N
            }
            shapes.push(new AABB(0, 0, .5-1/16, 1, 1, .5+1/16).rotate(cardinal_direction, shapePivot))
        }
        return shapes
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        const material  = block.material;
        let texture     = material.texture;
        let bH          = 1.0;
        let lm          = IndexedColor.WHITE;
        let c           = BLOCK.calcTexture(texture, DIRECTION.FORWARD);
        let flags       = 0;

        // Animations
        const anim_frames = BLOCK.getAnimations(material, 'up');
        if(anim_frames > 0) {
            lm.b = anim_frames;
            flags |= QUAD_FLAGS.FLAG_ANIMATED;
        }

        //
        if(material.is_portal) {
            // nether portal
            if(block.extra_data?.type) {
                flags |= QUAD_FLAGS.FLAG_MULTIPLY_COLOR;
                const portal_type = WorldPortal.getPortalTypeByID(block.extra_data.type);
                if(portal_type) {
                    lm.r = portal_type.color.r;
                    lm.g = portal_type.color.g;
                }
            }
        }

        // pack lm
        let pp = IndexedColor.packLm(lm);

        switch(cardinal_direction) {
            case CubeSym.ROT_Z:
            case ROTATE.N:
            case ROTATE.S: {
                // Front
                vertices.push(x + .5, z + .5, y + bH/2,
                    1, 0, 0,
                    0, 0, bH,
                    c[0], c[1], c[2], -c[3],
                    pp, flags);
                break;
            }
            case CubeSym.ROT_X:
            case ROTATE.E:
            case ROTATE.W: {
                // Left
                let n = NORMALS.LEFT;
                vertices.push(x + .5, z + .5, y + bH/2,
                    0, 1, 0,
                    0, 0, -bH,
                    c[0], c[1], -c[2], c[3],
                    pp, flags);
                break;
            }
        }

    }

}