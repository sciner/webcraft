import { Vector } from "../helpers.js";
import { BLOCK } from "../blocks.js";

export class Vox_Mesh {
    [key: string]: any;

    constructor(model, coord, shift, material, rotate) {

        const chunk     = model.chunk;
        const palette   = new Map();
        const size      = this.size = chunk.size;
        const offsety   = this.offsety = size.x;
        const offsetz   = this.offsetz = size.x * size.y;

        this.coord      = coord;
        this.blocks     = new Array(size.x * size.y * size.z);

        // Palette
        if(model.palette) {
            for (var i in model.palette) {
                if(!model.palette[i]) {
                    console.log(i, model.palette[i])
                }
                palette.set(parseInt(i), {id: model.palette[i].id});
            }
        }

        // Construct geometry
        let block = null;
        for (let j = 0; j < chunk.data.length; j += 4) {
            let x           = chunk.data[j + 0];
            let y           = chunk.data[j + 1];
            let z           = chunk.data[j + 2];
            const block_id  = chunk.data[j + 3];
            if(rotate && rotate.y == 1) {
                y = this.size.y - y;
            }
            if(!block || block.id != block_id) {
                block = palette.get(block_id);
                if(!block) {
                    block = BLOCK.STONE;
                }
            }
            //
            const index = x + (y * offsety) + (z * offsetz);
            this.blocks[index] = block;
        }

        this.temp_xyz = new Vector(0, 0, 0);

    }

    // getBlock
    getBlock(xyz) {
        this.temp_xyz.set(xyz.x - this.coord.x, xyz.y - this.coord.y, xyz.z - this.coord.z);
        const index = this.temp_xyz.x + (this.temp_xyz.z * this.offsety) + (this.temp_xyz.y * this.offsetz);
        if(index < 0 || index >= this.blocks.length) {
            return null;
        }
        return this.blocks[index];
    }

}