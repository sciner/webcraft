import {TX_CNT, ROTATE, Vector, Vector4, INVENTORY_STACK_DEFAUL_SIZE} from './helpers.js';
import {BLOCK} from './blocks.js';
import { push_cube } from './block_style/cube.js';
import { push_fence } from './block_style/fence.js';
import { push_ladder } from './block_style/ladder.js';
import { push_pane } from './block_style/pane.js';
import { push_plant } from './block_style/plant.js';
import { push_slab } from './block_style/slab.js';
import { push_stairs } from './block_style/stairs.js';
import { push_trapdoor } from './block_style/trapdoor.js';

export class BLOCK_FUNC {

    // getCardinalDirection...
    static getCardinalDirection(vec3) {
        let result = new Vector(0, 0, ROTATE.E);
        if(vec3) {
            if(vec3.z >= 45 && vec3.z < 135) {
                // do nothing
            } else if(vec3.z >= 135 && vec3.z < 225) {
                result.z = ROTATE.S;
            } else if(vec3.z >= 225 && vec3.z < 315) {
                result.z = ROTATE.W;
            } else {
                result.z = ROTATE.N;
            }
        }
        return result;
    }

    // Call before setBlock
    static makeExtraData(block, pos) {
        block = BLOCK.BLOCK_BY_ID[block.id];
        let extra_data = null;
        if(!block.tags) {
            return extra_data;
        }
        let is_trapdoor = block.tags.indexOf('trapdoor') >= 0;
        let is_stairs = block.tags.indexOf('stairs') >= 0;
        let is_slab = block.tags.indexOf('slab') >= 0;
        if(is_trapdoor || is_stairs || is_slab) {
            extra_data = {
                point: new Vector(pos.point.x, pos.point.y, pos.point.z)
            };
            if(is_trapdoor) {
                extra_data.opened = false;
            }
            if(pos.n.y == 1) {
                extra_data.point.y = 0;
            } else if(pos.n.y == -1) {
                extra_data.point.y = 1;
            }
        }
        return extra_data;
    }

    // Returns a block structure for the given id.
    static fromId(id) {
        if(this.BLOCK_BY_ID.hasOwnProperty(id)) {
            return this.BLOCK_BY_ID[id]
        }
        console.error('Warning: id missing in BLOCK ' + id);
        return this.DUMMY;
    }

    // Returns a block structure for the given id.
    static fromName(name) {
        if(name.indexOf(':') >= 0) {
            name = name.split(':')[1].toUpperCase();
        }
        if(this.hasOwnProperty(name)) {
            return this[name]
        }
        console.error('Warning: name missing in BLOCK ' + name);
        return this.DUMMY;
    }

    // Return plants for terrain generator
    static getPlants() {
        return [
            this.GRASS,
            this.DANDELION,
            // this.POPPY,
            this.TULIP,
            this.BROWN_MUSHROOM,
            this.RED_MUSHROOM
        ];
    }

    // Возвращает True если блок является растением
    static isPlants(id) {
        for(let p of this.getPlants()) {
            if(p.id == id) {
                return true;
            }
        }
        return false;
    }

    // Блок может быть уничтожен водой
    static destroyableByWater(block) {
        return block.planting || block.id == this.AIR.id;
    }

    // Стартовый игровой инвентарь
    static getStartInventory() {
        let blocks = [
            Object.assign({count: 5}, this.RED_MUSHROOM),
            Object.assign({count: 64}, this.SAND),
            Object.assign({count: 6}, this.BOOKCASE),
            Object.assign({count: 20}, this.GLOWSTONE),
            Object.assign({count: 4}, this.TEST)
        ];
        for(let key of Object.keys(blocks)) {
            let b = blocks[key];
            delete(b.texture);
            blocks[key] = b;
        }
        return blocks;
    }

    // getAll
    static getAll() {
        if(this.list) {
            return this.list;
        }
        let list = this.list = [];
        let id_list = [];
        // Function calc and return destroy time for specific block
        let calcDestroyTime = (block)  => {
            let destroy_time = .4;
            if(block.id == BLOCK.BEDROCK.id) {
                return -1;
            }
            // max_in_stack
            if(!block.hasOwnProperty('max_in_stack')) {
                block.max_in_stack = INVENTORY_STACK_DEFAUL_SIZE;
            }
            if(block.hasOwnProperty('style')) {
                if(block.style == 'planting') {
                    return 0;
                }
            }
            if(block.hasOwnProperty('sound')) {
                switch(block.sound) {
                    case 'webcraft:block.grass':
                        destroy_time = 1.;
                        break;
                    case 'webcraft:block.gravel':
                    case 'webcraft:block.sand': {
                        destroy_time = 2.;
                        break;
                    }
                    case 'webcraft:block.wood': {
                        destroy_time = 4.;
                        break;
                    }
                    case 'webcraft:block.stone': {
                        destroy_time = 7.;
                        break;
                    }
                }
            }
            return destroy_time;
        };
        for(let mat in this) {
            let B = this[mat];
            B.power = 1;
            if(typeof(B) == 'object') {
                if(id_list.indexOf(B.id) >= 0)  {
                    console.error('Duplicate block id ', B.id, B);
                }
                // calc destroy time
                B.destroy_time = calcDestroyTime(B);
                //
                id_list.push(B.id);
                B.name = mat;
                if(!B.light) {
                    B.light = null;
                }
                if(B.spawnable == true) {
                    if(B.style && B.style == 'planting') {
                        B.planting = true;
                    }
                    if(B.style && B.style == 'stairs') {
                        B.transparent = true;
                    }
                    if([18, 118, 152, 203, 159, 160, 74, 26, 133, 102, 168, 121, 169, 172, 193, 63, 64, 65, 71, 81, 83, 120, 146, 54, 194, 195, 196, 197, 115, 103, 116, 179, 180, 181, 182, 206].indexOf(B.id) >= 0) {
                        continue;
                    }
                    list.push(B);
                }
            }
        }
        return list;
    }

    /**
     * Возвращает время, необходимое для того, чтобы разбить блок голыми руками
     * @param { Object } block 
     * @param { Bool } force Фиксированное и ускоренное разбитие (например в режиме креатива)
     * @return float
     */
    static getDestroyTime(block, force, instrument) {
        let destroy_time = block.destroy_time;
        if(force) {
            destroy_time = 0;
        }
        return destroy_time;
    }

    // Возвращает координаты текстуры
    static calcTexture(c) {
        return [
            (c[0] + 0.5) / TX_CNT,
            (c[1] + 0.5) / TX_CNT,
            1 / TX_CNT,
            1 / TX_CNT,
        ];
    }

    /**
     * clearBlockCache...
     */
    static clearBlockCache() {
        this.block_cache = {};
        this.cachedBlocksUsed = 0;
        this.cachedBlocksMiss = 0;
    }

    /**
     * getCachedBlock...
     * @param { int } x 
     * @param { int } y 
     * @param { int } z 
     * @returns 
     */
    static getCachedBlock(x, y, z) {
        // return world.chunkManager.getBlock(x, y, z);
        let key = new Vector(x, y, z).toString();
        if(this.block_cache[key]) {
            this.cachedBlocksUsed++;
            return this.block_cache[key];
        }
        this.cachedBlocksMiss++;
        return this.block_cache[key] = world.chunkManager.getBlock(x, y, z);
    }

    // Функция определяет, отбрасывает ли указанный блок тень
    static visibleForAO(block) {
        const ao_transparent_blocks = [BLOCK.DUMMY.id, BLOCK.AIR.id];
        return ao_transparent_blocks.indexOf(block.id) < 0 &&
            block.style != 'planting';
    }

    // pushVertices
    static pushVertices(vertices, block, world, lightmap, x, y, z, neighbours, biome) {
        const style = 'style' in block ? block.style : '';
        if (['planting', 'sign'].indexOf(style) >= 0) {
            this.push_plant(block, vertices, world, lightmap, x, y, z, biome);
        } else if (style == 'pane') {
            push_pane(block, vertices, world, lightmap, x, y, z, neighbours);
        } else if (style == 'stairs') {
            push_stairs(block, vertices, world, lightmap, x, y, z, neighbours);
        } else if (style == 'slab') {
            push_slab(block, vertices, world, lightmap, x, y, z);
        } else if (style == 'ladder') {
            push_ladder(block, vertices, world, lightmap, x, y, z);
        } else if (style == 'fence') {
            this.push_fence(block, vertices, world, lightmap, x, y, z, neighbours, biome);
        } else if (style == 'trapdoor') {
            this.push_trapdoor(block, vertices, world, lightmap, x, y, z, neighbours, biome);
        } else if (['torch'].indexOf(style) >= 0) {
            this.push_cube(block, vertices, world, lightmap, x, y, z, neighbours, biome);
        } else {
            this.push_cube(block, vertices, world, lightmap, x, y, z, neighbours, biome);
        }
    }

    // Return inventory icon pos
    static getInventoryIconPos(inventory_icon_id) {
        let w = 32;
        let h = 32;
        return new Vector4(
            (inventory_icon_id % w) * w,
            Math.floor(inventory_icon_id / h) * h,
            w,
            h
        );
    }

}

BLOCK_FUNC.push_cube = push_cube;
BLOCK_FUNC.push_fence = push_fence;
BLOCK_FUNC.push_ladder = push_ladder;
BLOCK_FUNC.push_pane = push_pane;
BLOCK_FUNC.push_plant = push_plant;
BLOCK_FUNC.push_slab = push_slab;
BLOCK_FUNC.push_stairs = push_stairs;
BLOCK_FUNC.push_trapdoor = push_trapdoor;