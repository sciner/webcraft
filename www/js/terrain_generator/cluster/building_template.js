import { Vector, VectorCollector } from "../../helpers.js";

export class BuilgingTemplate {

    constructor(json, bm) {

        for(let prop of ['name', 'world', 'meta', 'size', 'door_pos', 'blocks']) {
            this[prop] = json[prop]
        }

        if(this.blocks) {
            this.rot = [ [], [], [], [] ];
            this.rotateBuildingBlockVariants(bm);
        }

    }

    /**
     * Create rotated variants
     * @param {*} this 
     * @param {*} bm 
     */
    rotateBuildingBlockVariants(bm) {

        const ROT_N = [18, 22, 7, 13];

        //
        const rot0 = (block) => {
            for(let direction = 0; direction < 4; direction++) {
                this.rot[direction].push(block);
            }
        };

        //
        const rot1 = (block) => {
            for(let direction = 0; direction < 4; direction++) {
                const rb = JSON.parse(JSON.stringify(block));
                if(rb.rotate) {
                    if(rb.rotate.y == 0) {
                        rb.rotate.x = ROT_N[(ROT_N.indexOf(rb.rotate.x) + direction) % 4];
                    } else {
                        rb.rotate.x = (rb.rotate.x + direction) % 4;
                    }
                }
                this.rot[direction].push(rb);
            }
        }

        //
        const rot2 = (block) => {
            for(let direction = 0; direction < 4; direction++) {
                const rb = JSON.parse(JSON.stringify(block));
                rb.rotate.x = (rb.rotate.x + direction) % 4;
                this.rot[direction].push(rb);
            }
        }

        //
        const rot3 = (block) => {
            for(let direction = 0; direction < 4; direction++) {
                const rb = JSON.parse(JSON.stringify(block));
                rb.rotate.x = (rb.rotate.x + direction + 2) % 4;
                this.rot[direction].push(rb);
            }
        }


        // Auto fill by air
        const air_blocks = [];
        if('y' in this.size) {
            let min_y = Infinity
            let two2map = new VectorCollector()
            for(let block of this.blocks) {
                if(block.move.y < min_y) {
                    min_y = block.move.y
                }
            }
            for(let block of this.blocks) {
                if(block.move.y - min_y < 2) {
                    two2map.set(new Vector(block.move.x, 0, block.move.z), true);
                }
            }
            for(const [vec, _] of two2map.entries()) {
                for(let y = 0; y < this.size.y; y++) {
                    air_blocks.push({block_id: 0, move: new Vector(vec.x, min_y + y, vec.z)})
                }
            }
        }

        //
        for(let block of [...air_blocks, ...this.blocks]) {

            const b = bm.fromId(block.block_id);

            if(b.tags.includes('rotate_by_pos_n')) {
                rot1(block);

            } else if(b.tags.includes('stairs') || b.tags.includes('ladder') || b.tags.includes('bed') || b.tags.includes('trapdoor') || ['banner', 'campfire', 'anvil', 'lantern', 'torch', 'door'].includes(b.style)) {
                rot2(block);

            } else if(['sign', 'armor_stand'].includes(b.style)) {
                rot3(block);

            } else {
                rot0(block);

            }

        }

    }

}