import { Vector } from "../../helpers.js";

//
export class BlockDrawer {

    constructor(object) {
        this.object = object;
        this.mirror_x = false;
        this.mirror_z = false;
        this.list = [];
    }

    /**
     * @param {*} cluster 
     * @param {*} chunk 
     */
    draw(cluster, chunk) {
        const vec = new Vector(0, 0, 0);
        const block_coord = this.object.pos.clone().subSelf(chunk.coord);
        const dir = this.object.direction;
        for(let i = 0; i < this.list.length; i++) {
            const item = this.list[i];
            vec.copyFrom(block_coord).addByCardinalDirectionSelf(item.move, dir + 2, this.mirror_x, this.mirror_z);
            cluster.setBlock(chunk, vec.x, vec.y, vec.z, item.block_id, item.rotate, item.extra_data);
        }
    }

    /**
     * @param {Vector} pos 
     * @param {int} block_id 
     * @param {int} dir 
     * @param {boolean} opened 
     * @param {boolean} left 
     */
    appendDoorBlocks(pos, block_id, dir, opened, left) {
        this.list.push({move: pos, block_id: block_id, extra_data: {point: new Vector(0, 0, 0), opened, left, is_head: false}});
        this.list.push({move: pos.add(new Vector(0, 1, 0)), block_id: block_id, extra_data: {point: new Vector(0, 0, 0), opened, left, is_head: true}});
    }

    /**
     * @param {Vector} pos 
     * @param {Vector} size 
     * @param {*} block_palette 
     */
    append4WallsBlocks(pos, size, block_palette) {
        block_palette.reset();
        for(let y = 0; y < size.y - 1; y++) {
            for(let x = 0; x < size.x; x++) {
                for(let z = 0; z < size.z; z++) {
                    const move = new Vector(pos.x + x, pos.y + y, pos.z + z);
                    if(x < 1 || z < 1 || y < 0 || x > size.x - 2 || z > size.z - 2 || y > size.y - 1) {
                        const block_id = block_palette.next().id;
                        this.list.push({move, block_id});
                    } else {
                        this.list.push({move, block_id: 0});
                    }
                }
            }
        }
    }

    /**
     * @param {Vector} pos 
     * @param {Vector} size 
     * @param {int} block_id 
     */
    appendBasementBlocks(pos, size, block_id) {

        // floor
        const floor_pos = pos.clone().addSelf(new Vector(0, -size.y + 1, 0))
        const floor_size = size.clone();

        this.appendQuboidBlocks(floor_pos, floor_size, block_id);

    }

    /**
     * @param {Vector} pos 
     * @param {Vector} size 
     * @param {int} block_id 
     * @param {*} extra_data 
     */
    appendQuboidBlocks(pos, size, block_id, extra_data = null) {
        for(let y = 0; y < size.y - 1; y++) {
            for(let x = 0; x < size.x; x++) {
                for(let z = 0; z < size.z; z++) {
                    const move = new Vector(pos.x + x, pos.y + y, pos.z + z);
                    const block = {move, block_id};
                    if(extra_data) {
                        block.extra_data = extra_data;
                    }
                    this.list.push(block);
                }
            }
        }
    }

}