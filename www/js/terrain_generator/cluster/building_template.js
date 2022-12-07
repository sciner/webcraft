import { Vector, VectorCollector } from "../../helpers.js";

import e3290 from "./building/data/e3290.json" assert { type: "json" };
import church from "./building/data/church.json" assert { type: "json" };
import nico from "./building/data/nico.json" assert { type: "json" };
import domikkam from "./building/data/domikkam.json" assert { type: "json" };
import domikder from "./building/data/domikder.json" assert { type: "json" };

//
export class BuilgingTemplate {

    constructor(json, bm) {

        if(!json) debugger

        for(let prop of ['name', 'world', 'meta', 'size', 'door_pos', 'blocks']) {
            if(prop in json) this[prop] = json[prop]
        }

        if(this.blocks) {
            this.rot = [ [], [], [], [] ];
            this.rotateBuildingBlockVariants(bm);
        }

    }

    static getSchema(name) {
        const _buildings = {church, e3290, nico, domikder, domikkam};
        const resp = _buildings[name]
        if(!resp) throw 'building_schema_not_found'
        return resp
    }

    /**
     * Create rotated variants
     * @param {*} this 
     * @param {*} bm 
     */
    rotateBuildingBlockVariants(bm) {

        const ROT_N = [18, 22, 7, 13];
        const CHEST_ID = bm.CHEST.id;

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
                        if(b.is_solid) {
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

            const obsidian = bm.fromId(90)
            const _vec = new Vector(0, 0, 0)

            const markAsCheckSolid = (pos) => {
                const block = all_blocks.get(_vec)
                if(block && block.block_id > 0) {
                    if(!block.mat.is_solid && !['bed'].includes(block.mat.style)) {
                        // если это не сплошной, то разрешаем его заменять сплошным блоком ландшафта
                        // (если такой будет на этой позиции)
                        block.check_is_solid = true
                    }
                    return true
                }
                return false;
            }

            const addObsidian = (pos) => {
                const block = {block_id: obsidian.id, move: pos.clone()}
                block.mat = obsidian
                all_blocks.set(block.move, block)
            }

            for(let y = 0; y < this.size.y; y++) {
                for(let x = 0; x < this.size.x; x++) {
                    // от двери назад
                    for(let z = 0; z < this.size.z; z++) {
                        _vec.set(x, y, z).addSelf(min)
                        if(markAsCheckSolid(_vec)) break
                        // addObsidian(_vec)
                    }
                    // сзади к двери
                    for(let z = this.size.z - 1; z >= 0; z--) {
                        _vec.set(x, y, z).addSelf(min)
                        if(markAsCheckSolid(_vec)) break
                        // addObsidian(_vec)
                    }
                }
                //
                for(let z = 0; z < this.size.z; z++) {
                    // слева направо
                    for(let x = 0; x < this.size.x; x++) {
                        _vec.set(x, y, z).addSelf(min)
                        if(markAsCheckSolid(_vec)) break
                        // addObsidian(_vec)
                    }
                    // справо налево
                    for(let x = this.size.x - 1; x >= 0; x--) {
                        _vec.set(x, y, z).addSelf(min)
                        if(markAsCheckSolid(_vec)) break
                        // addObsidian(_vec)
                    }
                }
            }
        }

        //
        for(const [_, block] of all_blocks.entries()) {

            // если это воздух, то просто прописываем его во все измерения
            if(block.block_id == 0) {
                rot0(block);
                continue
            }

            // получаем метариал
            const mat = block.mat;
            delete(block.mat);

            if(mat.id == CHEST_ID) {
                if(!block.extra_data) block.extra_data = {};
                block.extra_data = {...block.extra_data, generate: true, params: {source: 'building'}}
            }

            if(mat.tags.includes('rotate_by_pos_n')) {
                rot1(block);

            } else if(mat.tags.includes('stairs') || mat.tags.includes('ladder') || mat.tags.includes('bed') || mat.tags.includes('trapdoor') || ['banner', 'campfire', 'anvil', 'lantern', 'torch', 'door', 'chest', 'lectern', 'fence_gate'].includes(mat.style)) {
                rot2(block);

            } else if(['sign', 'armor_stand'].includes(mat.style)) {
                rot3(block);

            } else if(mat.can_rotate && block.rotate) {
                rot2(block);

            } else {
                rot0(block);

            }

        }

    }

}