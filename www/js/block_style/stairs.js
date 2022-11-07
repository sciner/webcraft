import {DIRECTION, ROTATE, TX_CNT, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';
import { CubeSym } from "../core/CubeSym.js";

const width = 1;
const height = .5;
const depth = 1;

// Ступеньки
export default class style {

    //
    static getRegInfo() {
        return {
            styles: ['stairs'],
            func: this.func
        };
    }

    // Return calculated info
    static calculate(block, pos, neighbours = null, chunkManager = null) {

        const {x, y, z}             = pos;
        const aabbs                 = [];
        const cardinal_direction    = block.getCardinalDirection();
        const on_ceil               = BLOCK.isOnCeil(block);

        //
        let sw = cardinal_direction == DIRECTION.NORTH || cardinal_direction == DIRECTION.EAST;
        let nw = cardinal_direction == DIRECTION.SOUTH || cardinal_direction == DIRECTION.EAST;
        let en = cardinal_direction == DIRECTION.SOUTH || cardinal_direction == DIRECTION.WEST;
        let se = cardinal_direction == DIRECTION.NORTH || cardinal_direction == DIRECTION.WEST;

        //
        const sides             = {};
        sides.BASE              = null;
        sides[DIRECTION.SOUTH]  = sw;
        sides[DIRECTION.WEST]   = nw;
        sides[DIRECTION.NORTH]  = en;
        sides[DIRECTION.EAST]   = se;

        // Bottom
        let aabb = new AABB();
        aabb.set(x + .5 - width/2, y, z + .5 - depth/2, x + .5 + width/2, y + height, z + .5 + depth/2);
        if(on_ceil) {
            aabb.translate(0, height, 0);
            sides.DOWN = aabb;
        }
        sides.BASE = aabb;

        // Prepare for tops
        // Даже не пытайся это понять и переделать
        const n = BLOCK.autoNeighbs(chunkManager, pos, cardinal_direction, neighbours);
        let changed = false;
        if(style.checkIfSame(n.SOUTH, on_ceil)) {
            // удаление лишних
            let cd = CubeSym.sub(n.SOUTH.getCardinalDirection(), cardinal_direction);
            if(!(style.checkIfSame(n.WEST, on_ceil) && n.WEST.getCardinalDirection() == cardinal_direction) && cd == ROTATE.W) {
                sides[(cardinal_direction + 2) % 4] = false;
                changed = true;
            } else if(!(style.checkIfSame(n.EAST, on_ceil) && n.EAST.getCardinalDirection() == cardinal_direction) && cd == ROTATE.E) {
                sides[(cardinal_direction + 3) % 4] = false;
                changed = true;
            }
        }
        if(!changed && style.checkIfSame(n.NORTH, on_ceil)) {
            // добавление нужных
            let cd2 = CubeSym.sub(n.NORTH.getCardinalDirection(), cardinal_direction);
            if(cd2 == ROTATE.E) {
                if(!(style.checkIfSame(n.WEST, on_ceil) && n.WEST.getCardinalDirection() == cardinal_direction)) {
                    sides[(cardinal_direction + 1) % 4] = true;
                }
            } else if(cd2 == ROTATE.W) {
                if(!(style.checkIfSame(n.EAST, on_ceil) && n.EAST.getCardinalDirection() == cardinal_direction)) {
                    sides[(cardinal_direction + 0) % 4] = true;
                }
            }
        }

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
        if(on_ceil) {
            aabb_top.translate(0, -.5, 0);
        }

        sides[DIRECTION.SOUTH] = sides[DIRECTION.SOUTH] ? aabb_top : null;
        sides[DIRECTION.EAST] = sides[DIRECTION.EAST] ? aabb_top.clone().translate(.5, 0, 0) : null;
        sides[DIRECTION.NORTH] = sides[DIRECTION.NORTH] ? aabb_top.clone().translate(.5, 0, .5) : null;
        sides[DIRECTION.WEST] = sides[DIRECTION.WEST] ? aabb_top.clone().translate(0, 0, .5) : null;

        //
        for(let i in sides) {
            if(sides[i]) {
                aabbs.push(sides[i]);
            }
        }

        //
        const resp = {
            on_ceil: on_ceil,
            aabbs: aabbs,
            sides: sides,
            shapes: null,
            getShapes(translate, expand_value) {
                if(this.shapes) {
                    return this.shapes;
                }
                this.shapes = [];
                const temp = new AABB();
                for(let aabb of this.aabbs) {
                    temp.copyFrom(aabb)
                        .translate(translate.x, translate.y, translate.z)
                        .expand(expand_value, expand_value, expand_value)
                    this.shapes.push(temp.toArray());
                }
                return this.shapes;
            }
        };

        return resp;

    }

    // Return TRUE if block sames
    static checkIfSame(checked_block, on_ceil) {
        const checked_block_on_ceil = BLOCK.isOnCeil(checked_block);
        if(checked_block_on_ceil != on_ceil) {
            return false;
        }
        return checked_block.id > 0 && checked_block.material.tags && checked_block.material.tags.includes('stairs');
    }

    // Main func
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const material              = block.material;
        const texture               = block.material.texture;
        const pos                   = new Vector(x, y, z);

        // полная текстура
        const c_up = BLOCK.calcTexture(texture, DIRECTION.UP);
        const c_south = BLOCK.calcMaterialTexture(material, DIRECTION.SOUTH, width, height);
        const c_north = [...c_south];

        const info = style.calculate(block, pos, neighbours);

        //
        if(info.on_ceil) {
            c_south[1] -= c_south[3];
            c_north[1] -= c_north[3];
            c_up[3] *= -1;
        }

        pushAABB(vertices, info.sides.BASE, pivot, matrix,
            {
                up:     new AABBSideParams(c_up, 0, 0, null, null, false),
                down:   new AABBSideParams([c_up[0], c_up[1], c_up[2], c_up[3] * (info.on_ceil ? 1 : -1)], 0, 0, null, null, false),
                south:  new AABBSideParams(c_south, 0, 0, null, null, false),
                north:  new AABBSideParams(c_north, 0, 0, null, null, false),
                west:   new AABBSideParams(c_north, 0, 0, null, null, false),
                east:   new AABBSideParams(c_south, 0, 0, null, null, false),
            },
            pos
        );

        // Tops
        c_up[2]     /= 2;
        c_up[3]     /= -2;
        c_south[2]  /= 2;
        c_north[2]  /= 2;
        c_south[0]  -= .25 / TX_CNT;
        c_north[0]  -= .25 / TX_CNT;
        if(info.on_ceil) {
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

        // sw
        if(info.sides[DIRECTION.SOUTH]) {
            pushAABB(vertices, info.sides[DIRECTION.SOUTH], pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] - .25/TX_CNT, c_up[1] + .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] - .25/TX_CNT, c_up[1] - .25/TX_CNT, c_up[2], -c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams(c_1, 0, 1, null, null, false),
                    west:   new AABBSideParams([c_2[0] + .5/TX_CNT, c_2[1], c_2[2], c_2[3]], 0, 1, null, null, false),
                    north:  new AABBSideParams([c_3[0] + .5/TX_CNT, c_3[1], c_3[2], c_3[3]], 0, 1, null, null, false),
                    east:  new AABBSideParams(c_4, 0, 1, null, null, false),
                },
                pos
            );
        }


        // se
        if(info.sides[DIRECTION.EAST]) {
            pushAABB(vertices, info.sides[DIRECTION.EAST], pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] + .25/TX_CNT, c_up[1] + .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] + .25/TX_CNT, c_up[1] - .25/TX_CNT, c_up[2], -c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams([c_1[0] + .5/TX_CNT, c_1[1], c_1[2], c_1[3]], 0, 1, null, null, false),
                    west:   new AABBSideParams([c_2[0] + .5/TX_CNT, c_2[1], c_2[2], c_2[3]], 0, 1, null, null, false),
                    north:  new AABBSideParams(c_3, 0, 1, null, null, false),
                    east:  new AABBSideParams(c_4, 0, 1, null, null, false),
                },
                pos
            );
        }

        // en
        if(info.sides[DIRECTION.NORTH]) {
            pushAABB(vertices, info.sides[DIRECTION.NORTH], pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] + .25/TX_CNT, c_up[1] - .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] + .25/TX_CNT, c_up[1] + .25/TX_CNT, c_up[2], -c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams([c_1[0] + .5/TX_CNT, c_1[1], c_1[2], c_1[3]], 0, 1, null, null, false),
                    west:   new AABBSideParams(c_2, 0, 1, null, null, false),
                    north:  new AABBSideParams(c_3, 0, 1, null, null, false),
                    east:  new AABBSideParams([c_4[0] + .5/TX_CNT, c_4[1], c_4[2], c_4[3]], 0, 1, null, null, false),
                },
                pos
            );
        }

        // nw
        if(info.sides[DIRECTION.WEST]) {
            pushAABB(vertices, info.sides[DIRECTION.WEST], pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] - .25/TX_CNT, c_up[1] - .25/TX_CNT, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] - .25/TX_CNT, c_up[1] + .25/TX_CNT, c_up[2], -c_up[3]], 0, 1, null, null, false),
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