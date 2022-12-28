import { Vector, VectorCollector } from "../../helpers.js";

//
export class BlockDrawer {

    constructor(object) {
        this.object = object;
        this.mirror_x = false;
        this.mirror_z = false;
        this.list = [];
    }

    /**
     * @param { import("./base.js").ClusterBase } cluster
     * @param {*} chunk 
     */
    draw(cluster, chunk) {
        const pos = new Vector(0, 0, 0);
        const block_coord = this.object.pos.clone().subSelf(chunk.coord);
        const dir = this.object.direction;
        const two2map = new VectorCollector()
        const _pos2d = new Vector();
        for(let i = 0; i < this.list.length; i++) {
            const item = this.list[i];
            pos.copyFrom(block_coord).addByCardinalDirectionSelf(item.move, dir + 2, this.mirror_x, this.mirror_z);
            cluster.setBlock(chunk, pos.x, pos.y, pos.z, item.block_id, item.rotate, item.extra_data, !!item.check_is_solid);
            //
            if(pos.x >= 0 && pos.y >= 0 && pos.z >= 0 && pos.x < chunk.size.x && pos.y < chunk.size.y && pos.z < chunk.size.z) {
                _pos2d.copyFrom(pos)
                _pos2d.y = 0
                two2map.set(_pos2d, Math.max(two2map.get(_pos2d), pos.y))
            }
        }
        // Remove grass in air over setted blocks
        const BLOCK_AIR_ID = 0
        if(two2map.size > 0) {
            for(const [pos, y] of two2map.entries()) {
                pos.y = y
                while(true) {
                    pos.y++
                    if(pos.y >= chunk.size.y) {
                        break
                    }
                    const over_block_id = cluster.getBlock(chunk, pos.x, pos.y, pos.z)
                    if(![31, 572].includes(over_block_id)) {
                        break
                    }
                    cluster.setBlock(chunk, pos.x, pos.y, pos.z, BLOCK_AIR_ID)
                }
            }
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
        const rotate = new Vector(dir, 0, 0);
        this.list.push({move: pos, block_id, rotate, extra_data: {point: new Vector(0, 0, 0), opened, left, is_head: false}});
        this.list.push({move: pos.add(new Vector(0, 1, 0)), block_id, rotate, extra_data: {point: new Vector(0, 0, 0), opened, left, is_head: true}});
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
     * @param {int} extend_area 
     */
    appendQuboidBlocks(pos, size, block_id, extra_data = null, extend_area = 0) {
        for(let y = 0; y < size.y - 1; y++) {
            const ea = Math.floor(extend_area * (y / size.y));
            for(let x = -ea; x < size.x + ea; x++) {
                for(let z = -ea; z < size.z + ea; z++) {
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

    /**
     * @deprecated
     * @param {*} bm 
     * @param {*} direction 
     * @param {*} blocks 
     */
    appendOwnBlocks(bm, direction, blocks) {
        const rotn = [18, 22, 7, 13];
        for(let block of blocks) {
            const b = bm.fromId(block.block_id);
            if(b.tags.includes('rotate_by_pos_n')) {
                if(block.rotate.y == 0) {
                    block.rotate.x = rotn[(rotn.indexOf(block.rotate.x) + direction) % 4];
                } else {
                    block.rotate.x = (block.rotate.x + direction) % 4;
                }
            } else if(
                b.tags.includes('stairs') ||
                b.tags.includes('ladder') ||
                b.tags.includes('bed') ||
                b.tags.includes('trapdoor') ||
                ['banner', 'campfire', 'anvil', 'lantern', 'torch', 'door'].includes(b.style)
            ) {
                block.rotate.x = (block.rotate.x + direction) % 4;
            } else if(['sign', 'armor_stand'].includes(b.style)) {
                block.rotate.x = (block.rotate.x + direction + 2) % 4;
            }
            this.list.push(block)
        }
    }

}