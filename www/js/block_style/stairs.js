import {DIRECTION, MULTIPLY, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";

// Ступеньки
export default class style {

    static getRegInfo() {
        return {
            styles: ['stairs'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours) {

        let texture         = block.material.texture;
        let lm              = MULTIPLY.COLOR.WHITE;
        let pos             = new Vector(x, y, z);
        let flags           = 0, sideFlags = 0, upFlags = 0;
        let shapes          = BLOCK.getShapes(pos, block, chunk, true, false, neighbours);

        // полная текстура
        let c_full = BLOCK.calcTexture(texture, DIRECTION.UP);

        for(let shape of shapes) {
            let x1          = shape[0] + pos.x + .5;
            let x2          = shape[3] + pos.x + .5;
            let y1          = shape[1] + pos.y + .5;
            let y2          = shape[4] + pos.y + .5;
            let z1          = shape[2] + pos.z + .5;
            let z2          = shape[5] + pos.z + .5;
            let xw          = x2 - x1; // ширина по оси X
            let yw          = y2 - y1; // ширина по оси Y
            let zw          = z2 - z1; // ширина по оси Z
            let xpos        = -.5 + x1 + xw/2;
            let y_top       = -.5 + y2;
            let y_bottom    = -.5 + y1;
            let zpos        = -.5 + z1 + zw/2;
            let c           = c_full;
            // Up; X,Z,Y
            vertices.push(xpos, zpos, y_top,
                xw, 0, 0,
                0, zw, 0,
                c[0], c[1], c[2] * xw, c[3] * zw,
                lm.r, lm.g, lm.b, flags | upFlags);
            // Bottom
            vertices.push(xpos, zpos, y_bottom,
                xw, 0, 0,
                0, -zw, 0,
                c[0], c[1], c[2] * xw, c[3] * zw,
                lm.r, lm.g, lm.b, flags);
            // South | Forward | z++ (XZY)
            vertices.push(xpos, zpos - zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, yw,
                c[0], c[1], c[2] * xw, -c[3] * yw,
                lm.r, lm.g, lm.b, flags | sideFlags);
            // North | Back | z--
            vertices.push(xpos, zpos + zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, -yw,
                c[0], c[1], -c[2] * xw, c[3] * yw,
                lm.r, lm.g, lm.b, flags | sideFlags);
            // West | Left | x--
            vertices.push(xpos - xw/2, zpos, y_bottom + yw/2,
                0, zw, 0,
                0, 0, -yw,
                c[0], c[1], -c[2] * zw, c[3] * yw,
                lm.r, lm.g, lm.b, flags | sideFlags);
            // East | Right | x++
            vertices.push(xpos + xw/2, zpos, y_bottom + yw/2,
                0, zw, 0,
                0, 0, yw,
                c[0], c[1], -c[2] * zw, c[3] * yw,
                lm.r, lm.g, lm.b, flags | sideFlags);
        }

    }

}