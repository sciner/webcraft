import {DIRECTION, MULTIPLY, Vector} from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import {BLOCK} from "../blocks.js";
import { getChunkAddr, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk.js";
// import {fillCube} from "../bedrockJsonParser.js";

const {mat4} = glMatrix;
const tmpMatrix = mat4.create();

export class Particles_Painting {

    // Constructor
    constructor(params) {

        this.block_material = BLOCK.PAINTING_FRAME;
        const resource_pack = this.block_material.resource_pack;

        //
        const material_key = this.block_material.material_key; // 'base/regular/paintintg_frame';
        this.modelMatrix    = mat4.create();
        this.material       = resource_pack.getMaterial(material_key);
        let lm              = MULTIPLY.COLOR.WHITE;
        let flags           = 0, sideFlags = 0, upFlags = 0;
        let c               = [2/4, 2/4, 1/4, 1/4];

        this.pos            = new Vector(params.aabb[0], params.aabb[1], params.aabb[2]);
        // this._chunk_addr    = new Vector(0, 0, 0);

        //
        this.lightTex       = null;
        this.life           = 1.0;
        this.vertices       = [];

        // console.log(params);

        for(let shape of [params.aabb]) {
            let x1          = shape[0] - this.pos.x;
            let y1          = shape[1] - this.pos.y;
            let z1          = shape[2] - this.pos.z;
            let x2          = shape[3] - this.pos.x;
            let y2          = shape[4] - this.pos.y;
            let z2          = shape[5] - this.pos.z;
            let xw          = x2 - x1; // ширина по оси X
            let yw          = y2 - y1; // ширина по оси Y
            let zw          = z2 - z1; // ширина по оси Z
            let xpos        = -xw/2 + x1 + xw; // + xw/2;
            let y_top       = y2;
            let y_bottom    = y1;
            let zpos        = -zw/2 + z1 + zw;
            // Up; X,Z,Y
            this.vertices.push(xpos, zpos, y_top,
                xw, 0, 0,
                0, zw, 0,
                c[0], c[1], c[2] * xw, c[3] * zw,
                lm.r, lm.g, lm.b, flags | upFlags);
            // Bottom
            this.vertices.push(xpos, zpos, y_bottom,
                xw, 0, 0,
                0, -zw, 0,
                c[0], c[1], c[2] * xw, c[3] * zw,
                lm.r, lm.g, lm.b, flags);
            // South | Forward | z-- (XZY)
            this.vertices.push(xpos, zpos - zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, yw,
                c[0], c[1], c[2] * xw, -c[3] * yw,
                lm.r, lm.g, lm.b, flags | sideFlags);
            // North | Back | z++
            this.vertices.push(xpos, zpos + zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, -yw,
                c[0], c[1], -c[2] * xw, c[3] * yw,
                lm.r, lm.g, lm.b, flags | sideFlags);
            // West | Left | x--
            this.vertices.push(xpos - xw/2, zpos, y_bottom + yw/2,
                0, zw, 0,
                0, 0, -yw,
                c[0], c[1], -c[2] * zw, c[3] * yw,
                lm.r, lm.g, lm.b, flags | sideFlags);
            // East | Right | x++
            this.vertices.push(xpos + xw/2, zpos, y_bottom + yw/2,
                0, zw, 0,
                0, 0, yw,
                c[0], c[1], -c[2] * zw, c[3] * yw,
                lm.r, lm.g, lm.b, flags | sideFlags);
        }

        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));

    }

    /*
    get chunk_addr() {
        return getChunkAddr(this.pos, this._chunk_addr);
    }

    updateLightTex(render) {
        const chunk = render.world.chunkManager.getChunk(this.chunk_addr);
        if (!chunk) {
            return;
        }
        this.chunk = chunk;
        this.lightTex = chunk.getLightTexture(render.renderBackend);
    }
    */

    // Draw
    draw(render, delta) {

        // this.updateLightTex(render);
        // this.material.changeLighTex(this.lightTex);

        render.renderBackend.drawMesh(
            this.buffer,
            this.material,
            this.pos,
            this.modelMatrix
        );

        // this.material.lightTex = null;
        this.material.shader.unbind();

    }

    destroy() {
        this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
