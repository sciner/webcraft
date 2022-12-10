import { IndexedColor, Vector, DIRECTION, QUAD_FLAGS } from '../helpers.js';
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

        if(block.material.name == 'IRON_BARS') {

            const texture = BLOCK.calcTexture(block.material.texture, DIRECTION.DOWN);
            const planes = [];
            planes.push(...[
                {"size": {"x": 2, "y": 16, "z": 2}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 0, "y": 0, "z": 0}},
                {"size": {"x": 2, "y": 16, "z": 2}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 0, "y": 0, "z": 0}}
            ]);
            // Проверка сторон, для рисования кусков
            if (BLOCK.canPaneConnect(neighbours.EAST)) {
                planes.push(...[{"size": {"x": 0, "y": 16, "z": 7}, "uv": [3.5, 8], "rot": [0, -Math.PI / 2, 0], "translate": {"x": 0, "y": 0, "z": -4.5}}]);
            }
            if (BLOCK.canPaneConnect(neighbours.WEST)) {
                planes.push(...[{"size": {"x": 0, "y": 16, "z": 7}, "uv": [12.5, 8], "rot": [0, -Math.PI / 2, 0], "translate": {"x": 0, "y": 0, "z": 4.5}}]);
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

        } else {

            const texture = BLOCK.calcTexture(block.material.texture, DIRECTION.DOWN);
            const texture_up = BLOCK.calcTexture(block.material.texture, DIRECTION.UP);
            const texture_up_rot = BLOCK.calcTexture(block.material.texture, 'up_rot');
            const flag = 0;
            const lm = IndexedColor.WHITE;
            const pos = new Vector(x, y, z);
            const rot = new Vector(0, 0, 0);
            const h = 15.99;
            const yt = 0.005;

            const main_part = {
                "size": {"x": 2, "y": h, "z": 2},
                "translate": {"x": 0, "y": yt, "z": 0},
                "faces": {
                    "up":    {"uv": [8, 8], "flag": flag, "texture": texture_up},
                    "down":  {"uv": [8, 8], "flag": flag, "texture": texture_up},
                    "north": {"uv": [8, 8], "flag": flag, "texture": texture},
                    "south": {"uv": [8, 8], "flag": flag, "texture": texture},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": texture},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": texture}
                }
            };

            // Geometries
            const parts = [main_part];

            const cn = BLOCK.canPaneConnect(neighbours.NORTH);
            const cs = BLOCK.canPaneConnect(neighbours.SOUTH);
            const ce = BLOCK.canPaneConnect(neighbours.EAST);
            const cw = BLOCK.canPaneConnect(neighbours.WEST);

            // Проверка сторон, для рисования кусков
            if(cn && cs && !ce && !cw) {
                main_part.size.z = 16;
                delete(main_part.faces.north);
                delete(main_part.faces.south);
            } else {
                if(cn) {
                    delete(main_part.faces.north);
                    const part = {
                        "size": {"x": 2, "y": h, "z": 7},
                        "translate": {"x": 0, "y": yt, "z": 4.5},
                        "faces": {
                            "up":    {"uv": [8, 8], "flag": flag, "texture": texture_up},
                            "down":  {"uv": [8, 8], "flag": flag, "texture": texture_up},
                            // "north": {"uv": [8, 8], "flag": flag, "texture": texture},
                            "west":  {"uv": [12.5, 8], "flag": flag, "texture": texture},
                            "east":  {"uv": [12.5, 8], "flag": flag, "texture": texture}
                        }
                    };
                    parts.push(part);
                }
                if(cs) {
                    delete(main_part.faces.south);
                    const part = {
                        "size": {"x": 2, "y": h, "z": 7},
                        "translate": {"x": 0, "y": yt, "z": -4.5},
                        "faces": {
                            "up":    {"uv": [8, 8], "flag": flag, "texture": texture_up},
                            "down":  {"uv": [8, 8], "flag": flag, "texture": texture_up},
                            // "north": {"uv": [8, 8], "flag": flag, "texture": texture},
                            "west":  {"uv": [3.5, 8], "flag": flag, "texture": texture},
                            "east":  {"uv": [3.5, 8], "flag": flag, "texture": texture}
                        }
                    };
                    parts.push(part);
                }
            }

            if(!cn && !cs && ce && cw) {
                main_part.size.x = 16;
                main_part.faces.up.texture = texture_up_rot;
                delete(main_part.faces.east);
                delete(main_part.faces.west);
            } else {
                if(ce) {
                    delete(main_part.faces.east);
                    const part = {
                        "size": {"x": 7, "y": h, "z": 2},
                        "translate": {"x": 4.5, "y": yt, "z": 0},
                        "faces": {
                            "up":    {"uv": [8, 8], "flag": flag, "texture": texture_up_rot},
                            "down":  {"uv": [8, 8], "flag": flag, "texture": texture_up_rot},
                            "north": {"uv": [12.5, 8], "flag": flag, "texture": texture},
                            "south": {"uv": [12.5, 8], "flag": flag, "texture": texture}
                        }
                    };
                    parts.push(part);
                }
                if(cw) {
                    delete(main_part.faces.west);
                    const part = {
                        "size": {"x": 7, "y": 16, "z": 2},
                        "translate": {"x": -4.5, "y": yt, "z": 0},
                        "faces": {
                            "up":    {"uv": [8, 8], "flag": flag, "texture": texture_up_rot},
                            "down":  {"uv": [8, 8], "flag": flag, "texture": texture_up_rot},
                            "north": {"uv": [3.5, 8], "flag": flag, "texture": texture},
                            "south": {"uv": [3.5, 8], "flag": flag, "texture": texture}
                        }
                    };
                    parts.push(part);
                }
            }

            for(let part of parts) {
                default_style.pushPART(vertices, {
                    ...part,
                    lm:         lm,
                    pos:        pos,
                    rot:        rot,
                    matrix:     matrix
                });
            }

        }

    }

}