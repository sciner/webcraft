import {TX_CNT, ROTATE, DIRECTION, NORMALS, Vector, Vector4, Color} from './helpers.js';
import {BLOCK} from './blocks.js';

export let MULTIPLY = {
    COLOR: {
        WHITE: new Color(816 / 1024, 1008 / 1024, 0, 0),
        GRASS: new Color(900 / 1024, 965 / 1024, 0, 0)
    }
};

export let QUAD_FLAGS = {}
QUAD_FLAGS.NORMAL_UP = 1;
QUAD_FLAGS.MASK_BIOME = 2;

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
            // stackable
            if(!block.hasOwnProperty('stackable')) {
                block.stackable = true;
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
                    if(B.style && B.style == 'fence') {
                        continue;
                    }
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
    static getDestroyTime(block, force) {
        let destroy_time = block.destroy_time;
        if(force) {
            destroy_time = 0; // Math.min(destroy_time, .2);
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

    // Pushes the vertices necessary for rendering a
    // specific block into the array.
    static push_cube(block, vertices, world, lightmap, x, y, z, neighbours, biome) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        // Ambient occlusion
        const ao_enabled = true;
        const ao_value = .23;

        const cardinal_direction    = BLOCK.getCardinalDirection(block.rotate).z;
        let flags = 0;
        let sideFlags = 0;
        let upFlags = 0;

        // Texture color multiplier
        let lm = MULTIPLY.COLOR.WHITE;
        if(block.id == BLOCK.DIRT.id) {
            lm = biome.dirt_color; // MULTIPLY.COLOR.GRASS;
            sideFlags = QUAD_FLAGS.MASK_BIOME;
            upFlags = QUAD_FLAGS.MASK_BIOME;
        }

        let DIRECTION_UP            = DIRECTION.UP;
        let DIRECTION_DOWN          = DIRECTION.DOWN;
        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        if(!block.name) {
            console.log('block', JSON.stringify(block), block.id);
            debugger;
        }

        let c, ao, neighbourBlock;
        let width                   = block.width ? block.width : 1;
        let height                  = block.height ? block.height : 1;
        let drawAllSides            = width != 1 || height != 1;
        let texture                 = BLOCK[block.name].texture;
        let blockLit                = true;

        // F R B L
        switch(cardinal_direction) {
            case ROTATE.S: {
                break;
            }
            case ROTATE.W: {
                DIRECTION_BACK      = DIRECTION.LEFT;
                DIRECTION_RIGHT     = DIRECTION.BACK;
                DIRECTION_FORWARD   = DIRECTION.RIGHT;
                DIRECTION_LEFT      = DIRECTION.FORWARD;
                break;
            }
            case ROTATE.N: {
                DIRECTION_BACK      = DIRECTION.FORWARD;
                DIRECTION_RIGHT     = DIRECTION.LEFT;
                DIRECTION_FORWARD   = DIRECTION.BACK;
                DIRECTION_LEFT      = DIRECTION.RIGHT;
                break;
            }
            case ROTATE.E: {
                DIRECTION_BACK      = DIRECTION.RIGHT;
                DIRECTION_RIGHT     = DIRECTION.FORWARD;
                DIRECTION_FORWARD   = DIRECTION.LEFT;
                DIRECTION_LEFT      = DIRECTION.BACK;
                break;
            }
        }

        // Can change height
        let bH         = 1.0;
        if(block.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(block.id) >= 0) {
            bH = Math.min(block.power, .9)
            let blockOver  = world.chunkManager.getBlock(x, y + 1, z);
            if(blockOver) {
                let blockOverIsFluid = (blockOver.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(blockOver.id) >= 0);
                if(blockOverIsFluid) {
                    bH = 1.0;
                }
            }
        }

        if(block.id == BLOCK.DIRT.id || block.id == BLOCK.SNOW_DIRT.id) {
            if(neighbours.UP && !neighbours.UP.transparent) {
                DIRECTION_BACK      = DIRECTION.DOWN;
                DIRECTION_RIGHT     = DIRECTION.DOWN;
                DIRECTION_FORWARD   = DIRECTION.DOWN;
                DIRECTION_LEFT      = DIRECTION.DOWN;
                sideFlags = 0;
            }
        }

        // Top
        neighbourBlock = neighbours.UP;
        if(drawAllSides || !neighbourBlock || neighbourBlock.transparent || block.fluid) {
            ao = [0, 0, 0, 0];
            if(ao_enabled) {
                let aa = this.getCachedBlock(x, y + 1, z - 1);
                let ab = this.getCachedBlock(x - 1, y + 1, z);
                let ac = this.getCachedBlock(x - 1, y + 1, z - 1);
                let ad = this.getCachedBlock(x, y + 1, z + 1);
                let ae = this.getCachedBlock(x + 1, y + 1, z);
                let af = this.getCachedBlock(x + 1, y + 1, z + 1);
                let ag = this.getCachedBlock(x - 1, y + 1, z + 1);
                let ah = this.getCachedBlock(x + 1, y + 1, z - 1);
                if(this.visibleForAO(aa)) {ao[0] = ao_value; ao[1] = ao_value;}
                if(this.visibleForAO(ab)) {ao[0] = ao_value; ao[3] = ao_value;}
                if(this.visibleForAO(ac)) {ao[0] = ao_value; }
                if(this.visibleForAO(ad)) {ao[2] = ao_value; ao[3] = ao_value; }
                if(this.visibleForAO(ae)) {ao[1] = ao_value; ao[2] = ao_value; }
                if(this.visibleForAO(af)) {ao[2] = ao_value;}
                if(this.visibleForAO(ag)) {ao[3] = ao_value;}
                if(this.visibleForAO(ah)) {ao[1] = ao_value;}
            }
            c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_UP));
            // n = NORMALS.UP;
            vertices.push(x + 0.5, z + 0.5, y + bH - 1 + height,
                1, 0, 0,
                0, 1, 0,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags | upFlags);
        }

        // Waters
        if([200, 202].indexOf(block.id) >= 0) {
            return;
        }

        // Bottom
        neighbourBlock = neighbours.DOWN;
        if(drawAllSides || !neighbourBlock || neighbourBlock.transparent) {
            ao = [.5, .5, .5, .5];
            c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_DOWN));
            vertices.push(x + 0.5, z + 0.5, y,
                1, 0, 0,
                0, -1, 0,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags);
        }

        // South | Front/Forward
        neighbourBlock = neighbours.FORWARD;
        if(drawAllSides || !neighbourBlock || neighbourBlock.transparent) {
            ao = [0, 0, 0, 0];
            if(ao_enabled) {
                // ao[0] - левый нижний
                // ao[1] - правый нижний
                // ao[2] - правый верхний
                // ao[3] - левый верхний
                let aa = this.getCachedBlock(x - 1, y, z - 1);
                let ab = this.getCachedBlock(x + 1, y, z - 1);
                let ac = this.getCachedBlock(x, y - 1, z - 1);
                let ad = this.getCachedBlock(x + 1, y - 1, z - 1);
                let ae = this.getCachedBlock(x, y + 1, z - 1);
                let af = this.getCachedBlock(x + 1, y + 1, z - 1);
                let ag = this.getCachedBlock(x - 1, y - 1, z - 1);
                let ah = this.getCachedBlock(x - 1, y + 1, z - 1);
                if(this.visibleForAO(aa)) {ao[0] = ao_value; ao[3] = ao_value;}
                if(this.visibleForAO(ab)) {ao[1] = ao_value; ao[2] = ao_value;}
                if(this.visibleForAO(ac)) {ao[0] = ao_value; ao[1] = ao_value;}
                if(this.visibleForAO(ad)) {ao[1] = ao_value;}
                if(this.visibleForAO(ae)) {ao[2] = ao_value; ao[3] = ao_value;}
                if(this.visibleForAO(af)) {ao[2] = ao_value;}
                if(this.visibleForAO(ag)) {ao[0] = ao_value;}
                if(this.visibleForAO(ah)) {ao[3] = ao_value;}
            }
            c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_FORWARD));
            vertices.push(x + .5, z + .5 - width / 2, y + bH / 2,
                1, 0, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
        }

        // North | Back
        neighbourBlock = neighbours.BACK;
        if(drawAllSides || !neighbourBlock || neighbourBlock.transparent) {
            ao = [0, 0, 0, 0];
            if(ao_enabled) {
                // ao[0] - правый верхний
                // ao[1] - левый верхний
                // ao[2] - левый нижний
                // ao[3] - правый нижний
                let aa = this.getCachedBlock(x + 1, y - 1, z + 1);
                let ab = this.getCachedBlock(x, y - 1, z + 1);
                let ac = this.getCachedBlock(x + 1, y, z + 1);
                let ad = this.getCachedBlock(x - 1, y, z + 1);
                let ae = this.getCachedBlock(x - 1, y - 1, z + 1);
                let af = this.getCachedBlock(x, y + 1, z + 1);
                let ag = this.getCachedBlock(x - 1, y + 1, z + 1);
                let ah = this.getCachedBlock(x + 1, y + 1, z + 1);
                if(this.visibleForAO(aa)) {ao[2] = ao_value;}
                if(this.visibleForAO(ab)) {ao[2] = ao_value; ao[3] = ao_value;}
                if(this.visibleForAO(ac)) {ao[1] = ao_value; ao[2] = ao_value;}
                if(this.visibleForAO(ad)) {ao[0] = ao_value; ao[3] = ao_value;}
                if(this.visibleForAO(ae)) {ao[3] = ao_value;}
                if(this.visibleForAO(af)) {ao[0] = ao_value; ao[1] = ao_value;}
                if(this.visibleForAO(ag)) {ao[0] = ao_value;}
                if(this.visibleForAO(ah)) {ao[1] = ao_value;}
            }
            c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_BACK));
            vertices.push(x + .5, z + .5 + width / 2, y + bH / 2,
                1, 0, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
        }

        // West | Left
        neighbourBlock = neighbours.LEFT;
        if(drawAllSides || !neighbourBlock || neighbourBlock.transparent) {
            ao = [0, 0, 0, 0];
            if(ao_enabled) {
                // ao[0] - правый верхний
                // ao[1] - левый верхний
                // ao[2] - левый нижний
                // ao[3] - правый нижний
                let aa = this.getCachedBlock(x - 1, y - 1, z - 1);
                let ab = this.getCachedBlock(x - 1, y - 1, z);
                let ac = this.getCachedBlock(x - 1, y - 1, z + 1);
                let ad = this.getCachedBlock(x - 1, y, z - 1);
                let ae = this.getCachedBlock(x - 1, y, z + 1);
                let af = this.getCachedBlock(x - 1, y + 1, z - 1);
                let ag = this.getCachedBlock(x - 1, y + 1, z);
                let ah = this.getCachedBlock(x - 1, y + 1, z + 1);
                if(this.visibleForAO(aa)) {ao[3] = ao_value;}
                if(this.visibleForAO(ab)) {ao[2] = ao_value; ao[3] = ao_value;}
                if(this.visibleForAO(ac)) {ao[2] = ao_value;}
                if(this.visibleForAO(ad)) {ao[0] = ao_value; ao[3] = ao_value;}
                if(this.visibleForAO(ae)) {ao[1] = ao_value; ao[2] = ao_value;}
                if(this.visibleForAO(af)) {ao[0] = ao_value;}
                if(this.visibleForAO(ag)) {ao[0] = ao_value; ao[1] = ao_value;}
                if(this.visibleForAO(ah)) {ao[1] = ao_value;} 
            }
            c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_LEFT));
            vertices.push(x + .5 - width / 2, z + .5, y + bH / 2,
                0, 1, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
        }

        // East | Right
        neighbourBlock = neighbours.RIGHT;
        if(drawAllSides || !neighbourBlock || neighbourBlock.transparent) {
            ao = [0, 0, 0, 0];
            if(ao_enabled) {
                // ao[0] - левый нижний
                // ao[1] - правый нижний
                // ao[2] - правый верхний
                // ao[3] - левый верхний
                let aa = this.getCachedBlock(x + 1, y, z - 1);
                let ab = this.getCachedBlock(x + 1, y, z + 1);
                let ac = this.getCachedBlock(x + 1, y - 1, z);
                let ad = this.getCachedBlock(x + 1, y - 1, z + 1);
                let ae = this.getCachedBlock(x + 1, y + 1, z + 1);
                let af = this.getCachedBlock(x + 1, y - 1, z - 1);
                let ag = this.getCachedBlock(x + 1, y + 1, z);
                let ah = this.getCachedBlock(x + 1, y + 1, z - 1);
                if(this.visibleForAO(aa)) {ao[0] = ao_value; ao[3] = ao_value;}
                if(this.visibleForAO(ab)) {ao[1] = ao_value; ao[2] = ao_value;}
                if(this.visibleForAO(ac)) {ao[0] = ao_value; ao[1] = ao_value;}
                if(this.visibleForAO(ad)) {ao[1] = ao_value;}
                if(this.visibleForAO(ae)) {ao[2] = ao_value;}
                if(this.visibleForAO(af)) {ao[0] = ao_value;}
                if(this.visibleForAO(ag)) {ao[2] = ao_value; ao[3] = ao_value;}
                if(this.visibleForAO(ah)) {ao[3] = ao_value;}
            }
            c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_RIGHT));
            vertices.push(x + .5 + width / 2, z + .5, y + bH / 2,
                0, 1, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
        }

    }
}

// Pushes the vertices necessary for rendering a
// specific block into the array.
function push_ladder(block, vertices, world, lightmap, x, y, z) {

    if(typeof block == 'undefined') {
        return;
    }

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).z;

    let texture     = BLOCK[block.name].texture;
    let blockLit    = true; // z >= lightmap[x][y];
    let bH          = 1.0;
    let width       = block.width ? block.width : 1;
    let lm          = MULTIPLY.COLOR.WHITE;
    let c           = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.FORWARD));

    switch(cardinal_direction) {
        case ROTATE.S: {
            // Front / NORMALS.FORWARD;
            vertices.push(x + .5, z + 1 - width, y + bH / 2,
                1, 0, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            break;
        }
        case ROTATE.W: {
            // Left / NORMALS.LEFT;
            vertices.push(x + 1 - width, z + .5, y + bH / 2,
                0, 1, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            break;
        }
        case ROTATE.N: {
            // Back / NORMALS.BACK;
            vertices.push(x + .5, z + width, y + bH / 2,
                1, 0, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            break;
        }
        case ROTATE.E: {
            // Right / NORMALS.RIGHT;
            vertices.push(x + width, z + .5, y + bH / 2,
                0, 1, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            break;
        }
    }

}

// check_xy_neighbor
function check_xy_neighbor(world, x, y, z) {
    let block = world.chunkManager.getBlock(x, y, z);
    let x_dir = 0;
    let y_dir = 0;
    // first decide x or y direction
    let b = world.chunkManager.getBlock(x - 1, y, z);
    if (x == 0
        || (b.id != 0 && !b.style)
        || b.style == block.style)
        x_dir ++;
    //
    b = world.chunkManager.getBlock(x + 1, y, z);
    //
    b = world.chunkManager.getBlock(x, y - 1, z);
    if (y == 0
        || (b.id != 0 && !b.style)
        || b.style == block.style)
        y_dir ++;
    b = world.chunkManager.getBlock(x, y + 1, z);
    /*
    if (y == world.sy - 1
        || (b.id != 0 && !b.style)
        || b.style == block.style)
        y_dir ++;
    */
    return [x_dir, y_dir];
}

// push_plane
export function push_plane(vertices, x, y, z, c, lm, n, x_dir, rot, xp, yp, zp, flags) {

    z = [y, y = z][0];
    zp = [yp, yp = zp][0];

    xp          = xp ? xp : 1; // rot ? 1.41 : 1.0;
    yp          = yp ? yp : 1; // rot ? 1.41 : 1.0;
    zp          = zp ? zp : 1; // rot ? 1.41 : 1.0;
    flags = flags || 0;

    if (x_dir) {
        if(rot) {
            vertices.push(x + xp/2, y + yp/2, z + zp/2,
                xp, yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, flags);
            vertices.push(x + xp/2, y + yp/2, z + zp/2,
                -xp, yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, flags);
        } else {
            vertices.push(x + xp/2, y + 0.5, z + zp/2,
                xp, 0, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, flags);
            vertices.push(x + xp/2, y + 0.5, z + zp/2,
                -xp, 0, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, flags);
        }
    } else {
        if(rot) {
            vertices.push(x + xp/2, y + yp/2, z + zp/2,
                -xp, -yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, flags);
            vertices.push(x + xp/2, y + yp/2, z + zp/2,
                xp, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, flags);
        } else {
            vertices.push(x + 0.5, y + yp/2, z + zp/2,
                0, yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, flags);
            vertices.push(x + 0.5, y + yp/2, z + zp/2,
                0, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, flags);
        }
    }
}

// Растения
function push_plant(block, vertices, world, lightmap, x, y, z, biome) {
    let texture     = BLOCK.fromId(block.id).texture;
    let blockLit    = true;
    let c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    let lm = MULTIPLY.COLOR.WHITE;
    let flags = QUAD_FLAGS.NORMAL_UP;
    // Texture color multiplier
    if(block.id == BLOCK.GRASS.id) {
        lm = biome.dirt_color;
        flags |= QUAD_FLAGS.MASK_BIOME;
    }
    let n = NORMALS.UP;
    if(block.id == BLOCK.GRASS.id) {
        y -= .15;
    }
    push_plane(vertices, x, y, z, c, lm, n, true, true, undefined, undefined, undefined, flags);
}

/*
// Плоскость
function push_pane(block, vertices, world, lightmap, x, y, z) {
    // let block = world.chunkManager.getBlock(x, y, z);
    let texture = BLOCK.fromId(block.id).texture;
	let blockLit = z >= lightmap[x][y];
    let blockLight = block.light ? block.light.toFloat() : null;
    let c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    let lightMultiplier = z >= lightmap[x][y] ? 1.0 : 0.6;
    let lm = new Color(
        lightMultiplier,
        lightMultiplier,
        lightMultiplier,
        lightMultiplier
    );
    if(blockLight) {
        lm.a += blockLight.a;
    }
    let dirs = check_xy_neighbor(world, x, y, z);
    push_plane(vertices, x, y, z, c, lm, dirs[0] >= dirs[1], false);
}
*/

// Ворота
function push_fence(block, vertices, world, lightmap, x, y, z) {
    let texture = BLOCK.fromId(block.id).texture;
    let blockLit = true;
    block.transparent = true;
    let c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    let lm = MULTIPLY.COLOR.WHITE;
    let n = NORMALS.UP;
    let dirs = check_xy_neighbor(world, x, y, z);
    if (dirs[0] * dirs[1] == 0 && dirs[0] + dirs[1] > 0) {
        push_plane(vertices, x, y, z, c, lm, n, dirs[0] > dirs[1], false, undefined, undefined, undefined, QUAD_FLAGS.NORMAL_UP);
    } else {
        push_plant(block, vertices, world, lightmap, x, y, z);
    }
}

// Ступеньки
function push_stairs(block, vertices, world, lightmap, x, y, z) {

    const half          = 0.5 / TX_CNT;
    let poses           = [];
    let texture         = BLOCK.fromId(block.id).texture;
    let lm              = MULTIPLY.COLOR.WHITE;
    let blockLit        = true;

    block.transparent   = true;

    // полная текстура
    let c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, null));

    // четверть текстуры
    let c_half = [
        c[0] - half/2,
        c[1] - half/2,
        c[2] - half,
        c[3] - half,
    ];
    // нижняя половина текстуры
    let c_half_bottom = [
        c[0],
        c[1] + half/2,
        c[2],
        c[3] - half,
    ];

    // стенка 1
    let n = NORMALS.FORWARD;
    push_plane(vertices, x, y, z - 0.5, c_half_bottom, lm, n, true, false, null, .5, null);

    // стенка 2
    n = NORMALS.BACK;
    push_plane(vertices, x, y, z + 0.5, c_half_bottom, lm, n, true, false, null, .5, null);

    // стенка 3
    n = NORMALS.RIGHT;
    push_plane(vertices, x + 0.5, y, z, c_half_bottom, lm, n, false, false, null, .5, null);

    // стенка 4
    n = NORMALS.LEFT;
    push_plane(vertices, x - 0.5, y, z, c_half_bottom, lm, n, false, false, null, .5, null);

    c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.DOWN));

    // дно
    n = NORMALS.DOWN;
    vertices.push(x + .5, z + .5, y,
        1, 0, 0,
        0, -1, 0,
        c[0], c[1], c[2], -c[3],
        lm.r, lm.g, lm.b,
        lm.a, lm.a, lm.a, lm.a, 0);

    // поверхность нижней ступени
    const bH = 0.5;
    n = NORMALS.UP;
    vertices.push(x + .5, z + .5, y + bH,
        1, 0, 0,
        0, 1, 0,
        c[0], c[1], c[2], c[3],
        lm.r, lm.g, lm.b,
        lm.a, lm.a, lm.a, lm.a, 0);

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).z;

    // F R B L
    switch(cardinal_direction) {
        case ROTATE.S: {
            poses = [
                new Vector(0, 0, .5),
                new Vector(-.5, 0, .5),
            ];
            break;
        }
        case ROTATE.W: {
            poses = [
                new Vector(0, 0, 0),
                new Vector(0, 0, .5),
            ];
            break;
        }
        case ROTATE.N: {
            poses = [
                new Vector(0, 0, 0),
                new Vector(-.5, 0, 0),
            ];
            break;
        }
        case ROTATE.E: {
            poses = [
                new Vector(-.5, 0, 0),
                new Vector(-.5, 0, .5),
            ];
            break;
        }
    }

    // Верхняя ступень
    for(let pose of poses) {

        // левая стенка
        n = NORMALS.RIGHT;
        push_plane(vertices, x + 0.5 + pose.x, y + .5, z + pose.z, c_half, lm, n, false, false, null, .5, .5);

        // передняя стенка
        n = NORMALS.FORWARD;
        push_plane(vertices, x + 0.5 + pose.x, y + 0.5, z - 0.5 + pose.z, c_half, lm, n, true, false, .5, .5, null);

        // задняя стенка
        n = NORMALS.BACK;
        push_plane(vertices, x + 0.5 + pose.x, y + 0.5, z + pose.z, c_half, lm, n, true, false, .5, .5, null);

        // правая стенка
        n = NORMALS.LEFT;
        push_plane(vertices, x + pose.x, y + 0.5, z + pose.z, c_half, lm, n, false, false, null, .5, .5);

        // поверхность
        n = NORMALS.UP;
        let bH = 1.0;
        vertices.push(x + .75 + pose.x, z + .25 + pose.z, y + bH,
            .5, 0, 0,
            0, .5, 0,
            c_half[0], c_half[1], c_half[2], c_half[3],
            lm.r, lm.g, lm.b,
            lm.a, lm.a, lm.a, lm.a, 0);
    }

}

// Панель
function push_pane(block, vertices, world, lightmap, x, y, z, neighbours) {

    if(typeof block == 'undefined') {
        return;
    }

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).z;

    let texture     = BLOCK[block.name].texture;
    let blockLit    = true;
    let bH          = 1.0;
    let lm          = MULTIPLY.COLOR.WHITE;
    let c           = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.FORWARD));

    switch(cardinal_direction) {
        case ROTATE.N:
        case ROTATE.S: {
            // Front
            let n = NORMALS.FORWARD;
            vertices.push(x + .5, z + .5, y + bH/2,
                1, 0, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            n = NORMALS.BACK;
            vertices.push(x + .5, z + .5, y + bH/2,
                1, 0, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            break;
        }
        case ROTATE.E:
        case ROTATE.W: {
            // Left
            let n = NORMALS.LEFT;
            vertices.push(x + .5, z + .5, y + bH/2,
                0, 1, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            // Right
            n = NORMALS.RIGHT;
            vertices.push(x + .5, z + .5, y + bH/2,
                0, 1, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            break;
        }
    }

}

// Плита
function push_slab(block, vertices, world, lightmap, x, y, z) {

    const half = 0.5 / TX_CNT;

    let texture = BLOCK.fromId(block.id).texture;
	let blockLit = true;
    block.transparent = true;

    // полная текстура
    let c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, null));

    // нижняя половина текстуры
    let c_half_bottom= [
        c[0],
        c[1] + half /2,
        c[2],
        c[3] - half,
    ];

    // South | Front/Forward
    let lm = MULTIPLY.COLOR.WHITE;
    let n = NORMALS.FORWARD;
    push_plane(vertices, x, y, z - .5, c_half_bottom, lm, n, true, false, null, .5, null);

    // North | Back
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.BACK;
    push_plane(vertices, x, y, z + .5, c_half_bottom, lm, n, true, false, null, .5, null);

    // правая стенка
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.RIGHT;
    push_plane(vertices, x + 0.5, y, z, c_half_bottom, lm, n, false, false, null, .5, null);

    // левая стенка
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.LEFT;
    push_plane(vertices, x - 0.5, y, z, c_half_bottom, lm, n, false, false, null, .5, null);

    // Up and down
    c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.DOWN));
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.DOWN;
    let ao = [0, 0, 0, 0];
    let flags = 0, sideFlags = 0, upFlags = 0;
    
    // Up
    vertices.push(x + 0.5, z + 0.5, y + .5,
        1, 0, 0,
        0, 1, 0,
        c[0], c[1], c[2], c[3],
        lm.r, lm.g, lm.b,
        ao[0], ao[1], ao[2], ao[3], flags | upFlags);
    
    // Down
    //c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_DOWN));
    vertices.push(x + 0.5, z + 0.5, y,
        1, 0, 0,
        0, -1, 0,
        c[0], c[1], c[2], c[3],
        lm.r, lm.g, lm.b,
        ao[0], ao[1], ao[2], ao[3], flags);

}

// pushVertices
BLOCK_FUNC.pushVertices = function(vertices, block, world, lightmap, x, y, z, neighbours, biome) {
    const style = 'style' in block ? block.style : '';
    if (['planting', 'torch', 'sign'].indexOf(style) >= 0) {
        push_plant(block, vertices, world, lightmap, x, y, z, biome);
    } else if (style == 'pane') {
        push_pane(block, vertices, world, lightmap, x, y, z, neighbours);
    } else if (style == 'stairs') {
        push_stairs(block, vertices, world, lightmap, x, y, z);
    } else if (style == 'slab') {
        push_slab(block, vertices, world, lightmap, x, y, z);
    } else if (style == 'ladder') {
        push_ladder(block, vertices, world, lightmap, x, y, z);
    } else if (style == 'fence') {
        push_fence(block, vertices, world, lightmap, x, y, z);
    } else {
        this.push_cube(block, vertices, world, lightmap, x, y, z, neighbours, biome);
    }
}

// Return inventory icon pos
BLOCK_FUNC.getInventoryIconPos = function(inventory_icon_id) {
    let w = 32;
    let h = 32;
    return new Vector4(
        (inventory_icon_id % w) * w,
        Math.floor(inventory_icon_id / h) * h,
        w,
        h
    );
}