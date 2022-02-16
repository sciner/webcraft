import {DIRECTION, MULTIPLY, Vector} from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import {BLOCK} from "../blocks.js";
import {Resources} from "../resources.js";
import { ChunkManager } from '../chunk_manager.js';
import { getChunkAddr } from "../chunk.js";

const {mat4} = glMatrix;

export class Particles_Painting {

    // Constructor
    constructor(params) {

        const block_material    = BLOCK.PAINTING_FRAME;
        const resource_pack     = block_material.resource_pack;
        const material_key      = block_material.material_key;
        const c                 = BLOCK.calcTexture(block_material.texture, DIRECTION.UP);
        const lm                = MULTIPLY.COLOR.WHITE;

        this.life               = 1.0;
        this.material           = resource_pack.getMaterial(material_key);
        let flags               = 0, sideFlags = 0, upFlags = 0;
        this.pos                = new Vector(params.aabb[0], params.aabb[1], params.aabb[2]);
        this.vertices           = [];

        // Find image for painting
        const size_key = params.size.join('x');
        const col = Resources._painting.sizes.get(size_key);
        if(!col) {
            throw 'error_invalid_painting_size|' + size_key;
        }
        const texture_c = col.get(params.image_name);
        if(!texture_c) {
            throw 'error_invalid_painting_image|' + params.image_name;
        }

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
            let sides_c     = {
                south: [c[0], c[1], c[2] * xw, -c[3] * yw], // z+
                north: [c[0], c[1], -c[2] * xw, c[3] * yw], // z-
                west: [c[0], c[1], -c[2] * zw, c[3] * yw], // x+
                east: [c[0], c[1], -c[2] * zw, c[3] * yw] // x-
            };
            if(params.pos_n.x > 0) {
                sides_c.east[0] = texture_c.x + texture_c.w / 2;
                sides_c.east[1] = texture_c.y + texture_c.h / 2;
                sides_c.east[2] = texture_c.w;
                sides_c.east[3] = -texture_c.h;
            } else if(params.pos_n.x < 0) {
                sides_c.west[0] = texture_c.x + texture_c.w / 2;
                sides_c.west[1] = texture_c.y + texture_c.h / 2;
                sides_c.west[2] = -texture_c.w;
                sides_c.west[3] = texture_c.h;
            } else if(params.pos_n.z > 0) {
                sides_c.north[0] = texture_c.x + texture_c.w / 2;
                sides_c.north[1] = texture_c.y + texture_c.h / 2;
                sides_c.north[2] = -texture_c.w;
                sides_c.north[3] = texture_c.h;
            } else if(params.pos_n.z < 0) {
                sides_c.south[0] = texture_c.x + texture_c.w / 2;
                sides_c.south[1] = texture_c.y + texture_c.h / 2;
                sides_c.south[2] = texture_c.w;
                sides_c.south[3] = -texture_c.h;
            }
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
            // North | Back | z++
            this.vertices.push(xpos, zpos + zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, -yw,
                ...sides_c.north,
                lm.r, lm.g, lm.b, flags | sideFlags);
            // South | Forward | z-- (XZY)
            this.vertices.push(xpos, zpos - zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, yw,
                ...sides_c.south,
                lm.r, lm.g, lm.b, flags | sideFlags);
            // West | Left | x--
            this.vertices.push(xpos - xw/2, zpos, y_bottom + yw/2,
                0, zw, 0,
                0, 0, -yw,
                ...sides_c.west,
                lm.r, lm.g, lm.b, flags | sideFlags);
            // East | Right | x++
            this.vertices.push(xpos + xw/2, zpos, y_bottom + yw/2,
                0, zw, 0,
                0, 0, yw,
                ...sides_c.east,
                lm.r, lm.g, lm.b, flags | sideFlags);
        }

        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));

    }

    // Draw
    draw(render, delta) {

        // For lighting
        if(!this.chunk) {
            const chunk_addr = getChunkAddr(this.pos.x, this.pos.y, this.pos.z);
            this.chunk = ChunkManager.instance.getChunk(chunk_addr);
            if(!this.chunk) {false;
                return 
            }
            this.modelMatrix = mat4.create();
            mat4.translate(this.modelMatrix, this.modelMatrix, 
                [
                    (this.pos.x - this.chunk.coord.x),
                    (this.pos.z - this.chunk.coord.z),
                    (this.pos.y - this.chunk.coord.y)
                ]
            )
        }
            const light = this.chunk.getLightTexture(render.renderBackend);
            this.material.changeLighTex(light);

        render.renderBackend.drawMesh(
            this.buffer,
            this.material,
            this.chunk.coord,
            this.modelMatrix
        );

        this.material.lightTex = null;
        this.material.shader.unbind();

    }

    destroy() {
        this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
