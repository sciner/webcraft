import { DIRECTION, IndexedColor, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { default as default_style } from '../block_style/default.js';

// import model_bookshelf from "../../data/bbmodel/energy_blade.json" assert { type: "json" };
// import model_bookshelf from "../../data/bbmodel/test.json" assert { type: "json" };
// import model_bookshelf from "../../data/bbmodel/sword.json" assert { type: "json" };
// import model_bookshelf from "../../data/bbmodel/black_big_can.json" assert { type: "json" };
import model_bookshelf from "../../data/bbmodel/garbage_monster.json" assert { type: "json" };
import { BBModel_Parser } from '../bbmodel/parser.js';
import { BLOCK } from '../blocks.js';

const {mat4} = glMatrix;

// Block model
export default class style {
    
    static getRegInfo() {
        return {
            styles: ['bbmodel'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 1, 1);
        return [aabb];
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined') {
            return;
        }

        const textures = block.material.texture;
        const model = new BBModel_Parser(model_bookshelf, textures);

        model.parse();

        //
        const cd = block.getCardinalDirection();
        matrix = mat4.create();
        switch(cd) {
            case DIRECTION.NORTH: 
                mat4.rotateY(matrix, matrix, Math.PI);
                break;
            case DIRECTION.WEST: 
                mat4.rotateY(matrix, matrix, Math.PI / 2);
                break;
            case DIRECTION.EAST: 
                mat4.rotateY(matrix, matrix, -Math.PI / 2);
                break;
        }

        //
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;

        // model.playAnimation('idle');
        model.playAnimation('walk');
        // model.playAnimation('attack2');

        model.root.pushVertices(vertices, pos, lm, matrix);

        // Draw stand
        style.drawStand(vertices, pos, lm, matrix);

    }

    // Stand
    static drawStand(vertices, pos, lm, matrix) {
        const flag = 0;
        const stone = BLOCK.calcTexture(BLOCK.STONE.texture, DIRECTION.WEST);
        const stand = [];
        stand.push(...[
            // stand
            {
                "size": {"x": 12, "y": 1, "z": 12},
                "translate": {"x":0, "y": -7, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "down": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "north": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "south": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": stone},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": stone}
                }
            }
        ]);
        for(const el of stand) {
            default_style.pushAABB(vertices, {
                ...el,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }
    }
    
}