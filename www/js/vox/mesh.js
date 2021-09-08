import GeometryTerrain from "../geometry_terrain.js";
import { Vector, MULTIPLY, DIRECTION } from "../helpers.js";
import {BLOCK} from "../blocks.js";

export class Vox_Mesh {

    constructor(chunk, coord, shift, material) {

        const data = chunk.data;
        const size = this.size = chunk.size;

        this.coord = coord;
        this.material = material;

        let DIRECTION_UP            = DIRECTION.UP;
        let DIRECTION_DOWN          = DIRECTION.DOWN;
        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        //
        const vertices      = [];
        this.block_types    = [];
        this.block_textures = {};

        let vectors = {
            UP: [1, 0, 0, 0, 1, 0],
            DOWN: [1, 0, 0, 0, -1, 0],
            SOUTH: [1, 0, 0, 0, 0, 1],
            NORTH: [1, 0, 0, 0, 0, -1],
            WEST: [0, 1, 0, 0, 0, -1],
            EAST: [0, 1, 0, 0, 0, 1]
        };

        let lm          = MULTIPLY.COLOR.WHITE;
        let ao          = [0, 0, 0, 0];
        let flags       = 0;
        let upFlags     = 0;

        // Store data in a volume for sampling
        const offsety   = this.offsety = size.x;
        const offsetz   = this.offsetz = size.x * size.y;
        const array     = new Uint8Array(size.x * size.y * size.z);
        
        //
        this.blocks = new Array(size.x * size.y * size.z);

        // Add vertices
        const add = (normals, x, y, z, tex) => {
            x = this.coord.x + x - shift.x + .5;
            y = this.coord.y + y - shift.y + .5;
            z = this.coord.z + z - shift.z + .5;
            vertices.push(x, z, y,
                ...normals,
                ...tex,           // texture
                lm.r, lm.g, lm.b, // rgb
                ...ao,            // AO
                flags | upFlags);
        }

        for(let j = 0; j < data.length; j += 4) {
            const x = data[ j + 0 ];
            const y = data[ j + 1 ];
            const z = data[ j + 2 ];
            const index = x + (y * offsety) + (z * offsetz);
            array[index] = 255;
        }

        // Construct geometry
        for (let j = 0; j < data.length; j += 4) {
            const x         = data[j + 0];
            const y         = data[j + 1];
            const z         = data[j + 2];
            const block_id  = data[j + 3];
            if(this.block_types.indexOf(block_id) < 0) {
                this.block_types.push(block_id);
                let block = BLOCK.CONCRETE;
                switch(block_id) {
                    case 81: {
                        block = BLOCK.CONCRETE;
                        break;
                    }
                    case 97: {
                        block = BLOCK.OAK_PLANK;
                        break;
                    }
                    case 121: {
                        block = BLOCK.STONE_BRICK;
                        break;
                    }
                    case 122: {
                        block = BLOCK.POLISHED_STONE;
                        break;
                    }
                    case 123: {
                        block = BLOCK.GRAVEL;
                        break;
                    }
                }
                let tex = {
                    LEFT:       BLOCK.calcTexture(block.texture(null, {}, 1, x, y, z, DIRECTION_LEFT)),
                    RIGHT:      BLOCK.calcTexture(block.texture(null, {}, 1, x, y, z, DIRECTION_RIGHT)),
                    UP:         BLOCK.calcTexture(block.texture(null, {}, 1, x, y, z, DIRECTION_UP)),
                    DOWN:       BLOCK.calcTexture(block.texture(null, {}, 1, x, y, z, DIRECTION_DOWN)),
                    FORWARD:    BLOCK.calcTexture(block.texture(null, {}, 1, x, y, z, DIRECTION_FORWARD)),
                    BACK:       BLOCK.calcTexture(block.texture(null, {}, 1, x, y, z, DIRECTION_BACK)),
                    block:      block
                };
                this.block_textures[block_id] = tex;
            }
            let tex = this.block_textures[block_id];
            // 
            const index = x + (y * offsety) + (z * offsetz);
            //
            let block = tex.block;
            this.blocks[index] = {
                id: block.id,
                name: block.name
            };
            // X
            if (array[index + 1] === 0 || x === size.x - 1) add(vectors.EAST, x + .5, z, -y, tex.LEFT);
            if (array[index - 1] === 0 || x === 0) add(vectors.WEST, x - .5, z, -y, tex.RIGHT);
            // Y
            if (array[index + offsetz] === 0 || z === size.z - 1) add(vectors.UP, x, z + .5, -y, tex.UP);
            if (array[index - offsetz] === 0 || z === 0) add(vectors.DOWN, x, z - .5, -y, tex.DOWN);
            // Z
            if (array[index - offsety] === 0 || y === 0) add(vectors.NORTH, x, z, -y + .5, tex.FORWARD);
            if (array[index + offsety] === 0 || y === size.y - 1) add(vectors.SOUTH, x, z, -y - .5, tex.BACK);
        }

        this.geometry = new GeometryTerrain(vertices);
        this.vertices = vertices;

    }

    // getBlock
    getBlock(xyz) {
        xyz = xyz.sub(this.coord);
        const index = xyz.x + (xyz.z * this.offsety) + (xyz.y * this.offsetz);
        if(index < 0 || index >= this.blocks.length) {
            return null;
        }
        return this.blocks[index];
    }

    // Draw
    draw(render) {
        render.drawMesh(this.geometry, this.material);
    }

}