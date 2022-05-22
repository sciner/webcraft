import {DIRECTION, ROTATE, MULTIPLY, TX_CNT, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';
import { CubeSym } from "../core/CubeSym.js";

// Ступеньки
export default class style {

    static getRegInfo() {
        return {
            styles: ['stairs'],
            func: this.func
        };
    }

    static checkIfSame = (checked_block, on_ceil) => {
        const checked_block_on_ceil = BLOCK.isOnCeil(checked_block);
        if(checked_block_on_ceil != on_ceil) {
            return false;
        }
        return checked_block.id > 0 && checked_block.material.tags && checked_block.material.tags.indexOf('stairs') >= 0;
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const material              = block.material;
        const texture               = block.material.texture;
        const pos                   = new Vector(x, y, z);
        const cardinal_direction    = block.getCardinalDirection();

        const width = 1;
        const height = .5;
        const depth = 1;

        // полная текстура
        const c_up = BLOCK.calcTexture(texture, DIRECTION.UP);
        const c_south = BLOCK.calcMaterialTexture(material, DIRECTION.SOUTH, width, height);
        const c_north = [...c_south];

        let aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - depth/2,
            x + .5 + width/2,
            y + height,
            z + .5 + depth/2
        );

        const on_ceil = BLOCK.isOnCeil(block);

        if(on_ceil) {
            aabb.translate(0, height, 0);
            c_south[1] -= c_south[3];
            c_north[1] -= c_north[3];
        }

        c_north[2] *= -1;
        c_north[3] *= -1;

        pushAABB(vertices, aabb, pivot, matrix,
            {
                up:     new AABBSideParams(c_up, 0, 1, null, null, false),
                down:   new AABBSideParams(c_up, 0, 1, null, null, false),
                south:  new AABBSideParams(c_south, 0, 1, null, null, false),
                north:  new AABBSideParams(c_north, 0, 1, null, null, false),
                west:   new AABBSideParams(c_north, 0, 1, null, null, false),
                east:   new AABBSideParams(c_south, 0, 1, null, null, false),
            },
            pos
        );

        // Tops
        const aabb_top = new AABB()
        aabb_top.set(
            x,
            y + height,
            z,
            x + width/2,
            y + height * 2,
            z + depth/2
        );

        c_up[2] /= 2;
        c_up[3] /= 2;
        c_south[2] /= 2;
        c_north[2] /= 2;

        c_south[0] -= .25 / TX_CNT;
        c_north[0] -= .25 / TX_CNT;

        if(on_ceil) {
            aabb_top.translate(0, -.5, 0);
            c_south[1] += .5 / TX_CNT;
            c_north[1] += .5 / TX_CNT;
        } else {
            c_south[1] -= .5 / TX_CNT;
            c_north[1] -= .5 / TX_CNT;
        }

        const c_1 = [...c_south];
        const c_2 = [...c_north];
        const c_3 = [...c_north];
        const c_4 = [...c_south];

        let sw = cardinal_direction == DIRECTION.NORTH || cardinal_direction == DIRECTION.EAST;
        let nw = cardinal_direction == DIRECTION.SOUTH || cardinal_direction == DIRECTION.EAST;
        let en = cardinal_direction == DIRECTION.SOUTH || cardinal_direction == DIRECTION.WEST;
        let se = cardinal_direction == DIRECTION.NORTH || cardinal_direction == DIRECTION.WEST;

        const dn = {};
        dn[DIRECTION.SOUTH] = sw;
        dn[DIRECTION.WEST] = nw;
        dn[DIRECTION.NORTH] = en;
        dn[DIRECTION.EAST] = se;

        const n = BLOCK.autoNeighbs(null, null, cardinal_direction, neighbours);

        // Даже не пытайся это понять и переделать
        let changed = false;
        if(style.checkIfSame(n.SOUTH, on_ceil)) {
            // удаление лишних
            let cd = CubeSym.sub(n.SOUTH.getCardinalDirection(), cardinal_direction);
            if(!(style.checkIfSame(n.WEST, on_ceil) && n.WEST.getCardinalDirection() == cardinal_direction) && cd == ROTATE.W) {
                dn[(cardinal_direction + 2) % 4] = false;
                changed = true;
            } else if(!(style.checkIfSame(n.EAST, on_ceil) && n.EAST.getCardinalDirection() == cardinal_direction) && cd == ROTATE.E) {
                dn[(cardinal_direction + 3) % 4] = false;
                changed = true;
            }
        }
        if(!changed && style.checkIfSame(n.NORTH, on_ceil)) {
            // добавление нужных
            let cd2 = CubeSym.sub(n.NORTH.getCardinalDirection(), cardinal_direction);
            if(cd2 == ROTATE.E) {
                if(!(style.checkIfSame(n.WEST, on_ceil) && n.WEST.getCardinalDirection() == cardinal_direction)) {
                    dn[(cardinal_direction + 1) % 4] = true;
                }
            } else if(cd2 == ROTATE.W) {
                if(!(style.checkIfSame(n.EAST, on_ceil) && n.EAST.getCardinalDirection() == cardinal_direction)) {
                    dn[(cardinal_direction + 0) % 4] = true;
                }
            }
        }

        // sw
        if(dn[DIRECTION.SOUTH]) {
            // sw
            pushAABB(vertices, aabb_top, pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] - .25/TX_CNT, c_up[1] + .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] - .25/TX_CNT, c_up[1] - .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams(c_1, 0, 1, null, null, false),
                    west:   new AABBSideParams([c_2[0] + .5/TX_CNT, c_2[1], c_2[2], c_2[3]], 0, 1, null, null, false),
                    north:  new AABBSideParams([c_3[0] + .5/TX_CNT, c_3[1], c_3[2], c_3[3]], 0, 1, null, null, false),
                    east:  new AABBSideParams(c_4, 0, 1, null, null, false),
                },
                pos
            );
        }


        // se
        if(dn[DIRECTION.EAST]) {
            // se
            pushAABB(vertices, aabb_top.clone().translate(.5, 0, 0), pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] + .25/TX_CNT, c_up[1] + .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] + .25/TX_CNT, c_up[1] - .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams([c_1[0] + .5/TX_CNT, c_1[1], c_1[2], c_1[3]], 0, 1, null, null, false),
                    west:   new AABBSideParams([c_2[0] + .5/TX_CNT, c_2[1], c_2[2], c_2[3]], 0, 1, null, null, false),
                    north:  new AABBSideParams(c_3, 0, 1, null, null, false),
                    east:  new AABBSideParams(c_4, 0, 1, null, null, false),
                },
                pos
            );
        }

        // en
        if(dn[DIRECTION.NORTH]) {
            // en
            pushAABB(vertices, aabb_top.clone().translate(.5, 0, .5), pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] + .25/TX_CNT, c_up[1] - .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] + .25/TX_CNT, c_up[1] + .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams([c_1[0] + .5/TX_CNT, c_1[1], c_1[2], c_1[3]], 0, 1, null, null, false),
                    west:   new AABBSideParams(c_2, 0, 1, null, null, false),
                    north:  new AABBSideParams(c_3, 0, 1, null, null, false),
                    east:  new AABBSideParams([c_4[0] + .5/TX_CNT, c_4[1], c_4[2], c_4[3]], 0, 1, null, null, false),
                },
                pos
            );
        }

        // nw
        if(dn[DIRECTION.WEST]) {
            pushAABB(vertices, aabb_top.clone().translate(0, 0, .5), pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] - .25/TX_CNT, c_up[1] - .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] - .25/TX_CNT, c_up[1] + .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams(c_1, 0, 1, null, null, false),
                    west:   new AABBSideParams(c_2, 0, 1, null, null, false),
                    north:  new AABBSideParams([c_3[0] + .5/TX_CNT, c_3[1], c_3[2], c_3[3]], 0, 1, null, null, false),
                    east:  new AABBSideParams([c_4[0] + .5/TX_CNT, c_4[1], c_4[2], c_4[3]], 0, 1, null, null, false),
                },
                pos
            );
        }

    }

}