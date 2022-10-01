import { DIRECTION, IndexedColor, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { default as default_style } from '../block_style/default.js';
import { BBModel_Parser } from '../bbmodel/parser.js';
import { BLOCK } from '../blocks.js';

const {mat4} = glMatrix;

// Load models
const models = new Map();

function initModels() {
    if(models.size > 0) return;
    for(let name of ['sword', 'test', 'bookshelf', 'black_big_can', 'garbage_monster']) {
        fetch(`../../data/bbmodel/${name}.json`)
            .then(response => response.json())
            .then(obj => {
                models.set(name, obj);
            }).catch((error) => {
                console.error('Error:', error);
            });
    }
}

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

        initModels();

        const textures      = block.material.texture;
        const pos           = new Vector(x, y, z);
        const lm            = IndexedColor.WHITE;

        const model_json    = models.get(block.extra_data?.model ?? 'garbage_monster');

        //
        if(model_json) {

            const model = new BBModel_Parser(model_json, textures);

            model.parse();

            //
            const cd = block.getCardinalDirection();
            matrix = mat4.create();

            // mat4.rotateX(matrix, matrix, performance.now() / 1000);
            // mat4.rotateY(matrix, matrix, performance.now() / 1000);
            // mat4.rotateZ(matrix, matrix, performance.now() / 1000);

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

            model.playAnimation('idle'); // idle, walk, jump, attack1, attack2
            model.draw(vertices, pos.add(new Vector(.5, 0, .5)), lm, matrix);

        }

        // Draw stand
        style.drawStand(vertices, pos, lm, null);

    }

    // Stand
    static drawStand(vertices, pos, lm, matrix) {
        const flag = 0;
        const stone = BLOCK.calcTexture(BLOCK.STONE.texture, DIRECTION.WEST);
        const stand = [];
        stand.push(...[
            // stand
            {
                "size": {"x": 16, "y": .5, "z": 16},
                "translate": {"x":0, "y": -7.5, "z": 0},
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