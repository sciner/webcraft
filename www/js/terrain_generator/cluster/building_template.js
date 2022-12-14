import { Vector, VectorCollector } from "../../helpers.js";

//
export class BuilgingTemplate {

    static schemas = {};

    constructor(json, bm) {

        if(!json) debugger
        if(!bm) debugger

        for(let prop of ['name', 'world', 'meta', 'size', 'door_pos', 'blocks']) {
            if(prop in json) this[prop] = json[prop]
        }

        if(this.blocks) {
            this.rot = [ [], [], [], [] ];
            this.rotateBuildingBlockVariants(bm);
        }

    }

    static addSchema(schema) {
        schema.world.pos1 = new Vector(schema.world.pos1)
        schema.world.pos2 = new Vector(schema.world.pos2)
        schema.world.door_bottom = new Vector(schema.world.door_bottom)
        this.schemas[schema.name] = schema
    }

    static fromSchema(name, bm) {
        return new BuilgingTemplate(this.getSchema(name), bm)
    }

    static getSchema(name) {
        const resp = this.schemas[name]
        if(!resp) throw 'building_schema_not_found'
        return resp
    }

    /**
     * Create rotated variants
     * @param {*} this 
     * @param {*} bm 
     */
    rotateBuildingBlockVariants(bm) {

        const all_blocks = new VectorCollector()
        const min = new Vector(Infinity, Infinity, Infinity)

        // Auto fill by air
        if('y' in this.size) {

            let two2map = new VectorCollector()
            for(let block of this.blocks) {
                if(block.move.x < min.x) min.x = block.move.x
                if(block.move.y < min.y) min.y = block.move.y
                if(block.move.z < min.z) min.z = block.move.z
            }
            if(min.y != Infinity) {
                // строим 2D карту пола строения
                for(let block of this.blocks) {
                    if(block.move.y - min.y < 2) {
                        const b = bm.fromId(block.block_id);
                        // не учитываем неполные блоки у основания строения в качестве пола
                        if(b.is_solid || [468].includes(b.id)) {
                            two2map.set(new Vector(block.move.x, 0, block.move.z), true);
                        }
                    }
                }
                // по 2D карте пола здания строим вертикальные столбы воздуха
                for(const [vec, _] of two2map.entries()) {
                    for(let y = 0; y < this.size.y; y++) {
                        const air_pos = new Vector(vec.x, min.y + y, vec.z)
                        all_blocks.set(air_pos, {block_id: 0, move: air_pos})
                    }
                }
            }

        }

        // добавляем все блоки из схемы, кроме блоков воздуха
        for(let block of this.blocks) {
            if(block.block_id > 0) {
                block.mat = bm.fromId(block.block_id)
                all_blocks.set(block.move, block)
            }
        }

        //
        if('y' in this.size && min.y != Infinity) {

            const _vec = new Vector(0, 0, 0)

            const markAsCheckSolid = (pos) => {
                const block = all_blocks.get(_vec)
                if(block && block.block_id > 0) {
                    if(!block.mat.is_solid && !['bed', 'door'].includes(block.mat.style)) {
                        // если это не сплошной, то разрешаем его заменять сплошным блоком ландшафта
                        // (если такой будет на этой позиции)
                        block.check_is_solid = true
                    }
                    return true
                }
                return false;
            }

            for(let y = 0; y < this.size.y; y++) {
                for(let x = 0; x < this.size.x; x++) {
                    // от двери назад
                    for(let z = 0; z < this.size.z; z++) {
                        _vec.set(x, y, z).addSelf(min)
                        if(markAsCheckSolid(_vec)) break
                    }
                    // сзади к двери
                    for(let z = this.size.z - 1; z >= 0; z--) {
                        _vec.set(x, y, z).addSelf(min)
                        if(markAsCheckSolid(_vec)) break
                    }
                }
                //
                for(let z = 0; z < this.size.z; z++) {
                    // слева направо
                    for(let x = 0; x < this.size.x; x++) {
                        _vec.set(x, y, z).addSelf(min)
                        if(markAsCheckSolid(_vec)) break
                    }
                    // справо налево
                    for(let x = this.size.x - 1; x >= 0; x--) {
                        _vec.set(x, y, z).addSelf(min)
                        if(markAsCheckSolid(_vec)) break
                    }
                }
            }
        }

        // Fill chest extra_data
        const CHEST_ID = bm.CHEST.id;
        for(const [pos, block] of all_blocks.entries()) {
            if(block.block_id == 199) {
                all_blocks.delete(pos)
            } else if(block.block_id == CHEST_ID) {
                if(!block.extra_data) block.extra_data = {};
                block.extra_data = {...block.extra_data, generate: true, params: {source: 'building'}}
            }
        }

        // Rotate property
        BuilgingTemplate.rotateBlocksProperty(all_blocks, this.rot, bm, [0, 1, 2, 3]);

    }

    /**
     * @param {VectorCollector} all_blocks 
     * @param {[][]} rot 
     * @param {*} bm 
     * @param {int[]} directions 
     */
    static rotateBlocksProperty(all_blocks, rot, bm, directions) {

        const ROT_N = [18, 22, 7, 13];
    
        //
        const rot0 = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                rot[direction].push(block);
            }
        };

        //
        const rot1 = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                const rb = JSON.parse(JSON.stringify(block));
                if(rb.rotate) {
                    if(rb.rotate.y == 0) {
                        rb.rotate.x = ROT_N[(ROT_N.indexOf(rb.rotate.x) + direction) % 4];
                    } else {
                        rb.rotate.x = (rb.rotate.x + direction) % 4;
                    }
                }
                rot[direction].push(rb);
            }
        }

        //
        const rot2 = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                const rb = JSON.parse(JSON.stringify(block));
                rb.rotate.x = (rb.rotate.x + direction) % 4;
                rot[direction].push(rb);
            }
        }

        //
        const rot3 = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                const rb = JSON.parse(JSON.stringify(block));
                rb.rotate.x = (rb.rotate.x + direction + 2) % 4;
                rot[direction].push(rb);
            }
        }

        //
        const rot4 = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                const rb = JSON.parse(JSON.stringify(block));
                rb.rotate.x = (rb.rotate.x - direction + 4) % 4;
                rot[direction].push(rb);
            }
        }

        const rotx8 = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                const rb = JSON.parse(JSON.stringify(block));
                rb.rotate.x = (rb.rotate.x - direction * 90) % 360;
                rot[direction].push(rb);
            }
        }

        for(const [_, block] of all_blocks.entries()) {

            // если это воздух, то просто прописываем его во все измерения
            if(block.block_id == 0) {
                rot0(block);
                continue
            }

            // получаем материал
            const mat = block.mat ?? bm.fromId(block.block_id);
            if(block.mat) {
                delete(block.mat);
            }

            if(['bed'].includes(mat.style)) {
                rot2(block);

            } else if(mat.tags.includes('rotate_x8')) {
                rotx8(block);

            } else if(['sign'].includes(mat.style)) {
                rot4(block);

            } else if(mat.tags.includes('rotate_by_pos_n')) {
                rot1(block);

            } else if(mat.tags.includes('stairs') || mat.tags.includes('ladder') || mat.tags.includes('trapdoor') || ['banner', 'campfire', 'anvil', 'lantern', 'torch', 'door', 'chest', 'lectern', 'fence_gate'].includes(mat.style)) {
                rot2(block);

            } else if(['armor_stand'].includes(mat.style)) {
                rot3(block);

            } else if(mat.can_rotate && block.rotate) {
                rot2(block);

            } else {
                rot0(block);

            }

        }

    }

}