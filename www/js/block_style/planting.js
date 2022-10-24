import {IndexedColor, DIRECTION, QUAD_FLAGS, Color, Vector, calcRotateMatrix} from '../helpers.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {BLOCK} from "../blocks.js";
import {impl as alea} from "../../vendors/alea.js";
import { CubeSym } from '../core/CubeSym.js';
import {AABB} from '../core/AABB.js';
import { default as default_style, TX_SIZE} from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { GRASS_PALETTE_OFFSET } from '../constant.js';

const {mat4} = glMatrix;

const MELON_ATTACHED_PLANES = [
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "move": {"x": 0, "y": 0, "z": 0}},
];

const DEFAULT_PLANES = [
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -Math.PI / 4, 0], "move": {"x": 0, "y": 0, "z": 0}},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -Math.PI / 4 * 3, 0], "move": {"x": 0, "y": 0, "z": 0}}
];

const AGRICULTURE_PLANES = [
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "move": {"x": 4/12, "y": 0, "z": 0}},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "move": {"x": -4/12, "y": 0, "z": 0}},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "move": {"x": 0, "y": 0, "z": 4/12}},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "move": {"x": 0, "y": 0, "z": -4/12}}
];

const SUNFLOWER_PLANES = [
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 4, 0], "move": {"x": 0, "y": 0, "z": 0}, "material": DIRECTION.UP},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -Math.PI / 4, 0], "move": {"x": 0, "y": 0, "z": 0}, "material": DIRECTION.UP},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, Math.PI / 8], "move": {"x": 0.1, "y": 0, "z": 0}, "material": DIRECTION.NORTH},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, Math.PI / 8], "move": {"x": 0.098, "y": 0, "z": 0}, "material": DIRECTION.SOUTH}
];

const DEFAULT_AABB_SIZE = new Vector(12, 12, 12);

const aabb = new AABB();
const pivotObj = {x: 0.5, y: .5, z: 0.5};

const RANDOMS_COUNT = CHUNK_SIZE_X * CHUNK_SIZE_Z;
const randoms = new Array(RANDOMS_COUNT);
const a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

//
const _pl = {};
const _vec = new Vector(0, 0, 0);

// Растения/Цепи
export default class style {

    static lm = new IndexedColor();

    static getRegInfo() {
        return {
            styles: ['planting'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {

        const aabb_size = block.material.aabb_size || DEFAULT_AABB_SIZE;
        aabb.set(0, 0, 0, 0, 0, 0)
        aabb
            .translate(.5 * TX_SIZE, aabb_size.y/2, .5 * TX_SIZE)
            .expand(aabb_size.x/2, aabb_size.y/2, aabb_size.z/2)
            .div(TX_SIZE);

        // Rotate
        if(block.getCardinalDirection) {
            let cardinal_direction = block.getCardinalDirection();
            let matrix = CubeSym.matrices[cardinal_direction];
            // on the ceil
            if(block.rotate && block.rotate.y == -1) {
                if(block.material.tags.includes('rotate_by_pos_n')) {
                    aabb.translate(0, 1 - aabb.y_max, 0)
                }
            }
            aabb.applyMatrix(matrix, pivotObj);
        }

        return [aabb];
    }

    //
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const material = block.material;
        const cardinal_direction = block.getCardinalDirection();

        // Get texture
        let texture_dir = DIRECTION.DOWN;
        if(block.hasTag('is_tall_plant')) {
            const top_id = neighbours.UP?.id;
            const bottom_id = neighbours.DOWN?.id;
            if(top_id != block.id) {
                if(bottom_id == block.id) {
                    texture_dir = DIRECTION.UP;
                } else {
                    texture_dir = DIRECTION.NORTH;
                }
            }
        } else {
            if('has_head' in material && block.extra_data && block.extra_data?.is_head) {
                texture_dir = DIRECTION.UP;
            }
        }

        let texture = BLOCK.calcMaterialTexture(material, texture_dir, null, null, block);

        let dx = 0, dy = 0, dz = 0;
        let flag = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;

        style.lm.set(IndexedColor.WHITE);
        style.lm.b = BLOCK.getAnimations(material, 'up');
        if(style.lm.b > 1) {
            flag |= QUAD_FLAGS.FLAG_ANIMATED;
        }

        //
        if(material.planting) {
            if(neighbours && neighbours.DOWN) {
                const under_height = neighbours.DOWN.material.height;
                if(under_height && under_height < 1) {
                    if(cardinal_direction == 0 || cardinal_direction == CubeSym.ROT_Y3) {
                        dy -= 1 - under_height;
                    }
                }
            }
        }

        //
        const is_flower = block.hasTag('flower');
        const is_agriculture = block.hasTag('agriculture');
        const is_grass = material.is_grass;
        if(is_grass) {
            dy -= .15;
            flag |= QUAD_FLAGS.FLAG_LEAVES;
        }

        // Matrix
        matrix = calcRotateMatrix(material, block.rotate, cardinal_direction, matrix);
        if(material.planting && !block.hasTag('no_random_pos')) {
            if(is_grass || is_flower) {
                let index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % randoms.length;
                dx = randoms[index] * 12/16 - 6/16;
                dz = randoms[RANDOMS_COUNT - index] * 12/16 - 6/16;
                dy -= .2 * randoms[index];
                if(!matrix) {
                    matrix = mat4.create();
                }
                mat4.rotateY(matrix, matrix, Math.PI*2 * randoms[index]);
            }
        }

        // Texture color multiplier
        if(block.hasTag('mask_biome')) {
            style.lm.set(dirt_color);
            style.lm.r += GRASS_PALETTE_OFFSET;
            flag |= QUAD_FLAGS.MASK_BIOME;
        }

        // Planes
        let planes = material.planes || (is_agriculture ? AGRICULTURE_PLANES : DEFAULT_PLANES);

        // Sunflower
        if (material.name == 'SUNFLOWER') {
            dy = 0;
            flag = flag | QUAD_FLAGS.NO_CAN_TAKE_AO;
            if (block.extra_data?.is_head) {
                planes = SUNFLOWER_PLANES;
            } else {
                texture = BLOCK.calcMaterialTexture(material, DIRECTION.DOWN, null, null, block);
            }
        }

        // Melon seeds
        if (material.name == 'MELON_SEEDS' || material.name == 'PUMPKIN_SEEDS') {
            const is_west = (material.name == 'MELON_SEEDS') ? neighbours.WEST.id == BLOCK.MELON.id : neighbours.WEST.id == BLOCK.PUMPKIN.id;
            const is_east = (material.name == 'MELON_SEEDS') ? neighbours.EAST.id == BLOCK.MELON.id : neighbours.EAST.id == BLOCK.PUMPKIN.id;
            const is_north = (material.name == 'MELON_SEEDS') ? neighbours.NORTH.id == BLOCK.MELON.id : neighbours.NORTH.id == BLOCK.PUMPKIN.id;
            const is_south = (material.name == 'MELON_SEEDS') ? neighbours.SOUTH.id == BLOCK.MELON.id : neighbours.SOUTH.id == BLOCK.PUMPKIN.id;
            if (is_west || is_east || is_north || is_south) {
                dy = -0.2;
                texture = BLOCK.calcMaterialTexture(material, DIRECTION.DOWN, null, null, block);
                planes = MELON_ATTACHED_PLANES;
                if (is_north) {
                    planes[0].rot[1] = Math.PI;
                } else if (is_west) {
                    planes[0].rot[1] = Math.PI * 3 / 2;
                } else if (is_east) {
                    planes[0].rot[1] = Math.PI / 2;
                } else {
                    planes[0].rot[1] = 0;
                }
            } else {
                dy = 0.2 * block.extra_data.stage - 0.9;
                texture = BLOCK.calcMaterialTexture(material, DIRECTION.UP, null, null, block);
            }
        }

        for(let i = 0; i < planes.length; i++) {
            const plane = planes[i];
            // fill object
            if (!isNaN(plane.material)) {
                texture = BLOCK.calcMaterialTexture(material, plane.material);
            }
            _pl.size     = plane.size;
            _pl.uv       = plane.uv;
            _pl.rot      = plane.rot;
            _pl.lm       = style.lm;
            _pl.pos      = _vec.set(
                x + dx + (plane.move?.x || 0),
                y + dy + (plane.move?.y || 0),
                z + dz + (plane.move?.z || 0)
            );
            _pl.matrix   = matrix;
            _pl.flag     = flag;
            _pl.texture  = texture;
            default_style.pushPlane(vertices, _pl);
        }

    }

}