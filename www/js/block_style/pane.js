import { IndexedColor, Vector, DIRECTION } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { default as default_style } from './default.js';
import glMatrix from '../../vendors/gl-matrix-3.3.min.js';

const {mat4} = glMatrix;

// Панель
export default class style {

    static getRegInfo() {
        return {
            styles: ['pane'],
            func: this.func
        };
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }
        
        const texture = BLOCK.calcTexture(block.material.texture, DIRECTION.DOWN);
        const planes = [];
        planes.push(...[
            {"size": {"x": 2, "y": 16, "z": 2}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 0, "y": 0, "z": 0}},
            {"size": {"x": 2, "y": 16, "z": 2}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 0, "y": 0, "z": 0}}
        ]);
        // Проверка сторон, для рисования кусков
        if (BLOCK.canPaneConnect(neighbours.EAST)) {
            planes.push(...[{"size": {"x": 0, "y": 16, "z": 7}, "uv": [3.5, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 0, "y": 0, "z": -4.5}}]);
        }
        if (BLOCK.canPaneConnect(neighbours.WEST)) {
            planes.push(...[{"size": {"x": 0, "y": 16, "z": 7}, "uv": [12.5, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 0, "y": 0, "z": 4.5}}]);
        }
        if (BLOCK.canPaneConnect(neighbours.SOUTH)) {
            planes.push(...[{"size": {"x": 0, "y": 16, "z": 7}, "uv": [3.5, 8], "rot": [0, 0, 0], "translate": {"x": 0, "y": 0, "z": -4.5}}]);
        }
        if (BLOCK.canPaneConnect(neighbours.NORTH)) {
            planes.push(...[{"size": {"x": 0, "y": 16, "z": 7}, "uv": [12.5, 8], "rot": [0, 0, 0], "translate": {"x": 0, "y": 0, "z": 4.5}}]);
        }
        
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