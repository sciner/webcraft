import { IndexedColor, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

// import model_bookshelf from "../../data/bbmodel/energy_blade.json" assert { type: "json" };
// import model_bookshelf from "../../data/bbmodel/test.json" assert { type: "json" };
// import model_bookshelf from "../../data/bbmodel/sword.json" assert { type: "json" };
// import model_bookshelf from "../../data/bbmodel/black_big_can.json" assert { type: "json" };
import model_bookshelf from "../../data/bbmodel/garbage_monster.json" assert { type: "json" };
import { BBModel_Parser } from '../bbmodel/parser.js';

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

        /*
        //
        const cd = block.getCardinalDirection();
        matrix = mat4.create();
        switch(cd) {
            case DIRECTION.NORTH: 
                mat4.rotateY(matrix, matrix, Math.PI);
                break;
            case DIRECTION.WEST: 
                mat4.rotateY(matrix, matrix, -Math.PI / 2);
                break;
            case DIRECTION.EAST: 
                mat4.rotateY(matrix, matrix, Math.PI / 2);
                break;
        }
        */

        //
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;

        model.root.pushVertices(vertices, pos, lm, matrix);

    }
    
}