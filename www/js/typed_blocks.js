import {Vector, VectorCollector} from "./helpers.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "./chunk.js";
import {BLOCK} from "./blocks.js";

export class TBlock {

    constructor(tb, vec) {
        this.init(tb, vec);
    }

    init(tb = this.tb, vec = this.vec) {
        this.tb = tb;
        this.vec = vec;
        this.index = this.vec ? BLOCK.getIndex(this.vec) : NaN;
        return this;
    }

    get posworld() {
        return this.vec.add(this.tb.coord);
    }

    //
    get pos() {
        return this.vec;
    }

    //
    get id() {
        return this.tb.id[this.index];
    }
    set id(value) {
        this.tb.id[this.index] = value;
    }

    //
    get power() {
        let resp = this.tb.power.get(this.vec);
        if(resp === null) resp = 1;
        return resp;
    }
    set power(value) {
        if(value) return this.tb.power.set(this.vec, value);
        this.tb.power.delete(this.vec);
    }

    //
    get rotate() {
        return this.tb.rotate.get(this.vec);
    }
    set rotate(value) {
        if(value) return this.tb.rotate.set(this.vec, value);
        this.tb.rotate.delete(this.vec);
    }

    // entity_id
    get entity_id() {
        return this.tb.entity_id.get(this.vec);
    }
    set entity_id(value) {
        if(value) return this.tb.entity_id.set(this.vec, value);
        this.tb.entity_id.delete(this.vec);
    }

    // texture
    get texture() {
        return this.tb.texture.get(this.vec);
    }
    set texture(value) {
        if(value) return this.tb.texture.set(this.vec, value);
        this.tb.texture.delete(this.vec);
    }

    // extra_data
    get extra_data() {
        return this.tb.extra_data.get(this.vec);
    }
    set extra_data(value) {
        if(value) return this.tb.extra_data.set(this.vec, value);
        this.tb.extra_data.delete(this.vec);
    }

    // falling
    get falling() {
        return this.tb.falling.get(this.vec);
    }
    set falling(value) {
        if(value) return this.tb.falling.set(this.vec, value);
        this.tb.falling.delete(this.vec);
    }

    // vertices
    get vertices() {
        return this.tb.vertices.get(this.vec);
    }
    set vertices(value) {
        if(value) return this.tb.vertices.set(this.vec, value);
        this.tb.vertices.delete(this.vec);
    }

    // shapes
    get shapes() {
        return this.tb.shapes.get(this.vec);
    }
    set shapes(value) {
        if(value) return this.tb.shapes.set(this.vec, value);
        this.tb.shapes.delete(this.vec);
    }

    // properties
    get properties() {
        return BLOCK.BLOCK_BY_ID.get(this.id) || null;
    }

    // material
    get material() {
        return BLOCK.BLOCK_BY_ID.get(this.id) || null;
    }

    //
    getCardinalDirection() {
        return BLOCK.getCardinalDirection(this.rotate);
    }

    // Дальнейшие свойства нужны только для prismarine-physics (физика перса)
    //
    get type() {
        return this.id;
    }
    getProperties() {
        return this.properties;
    }
    // position
    get position() {
        // return new Vector(this.vec.x + this.tb.coord.x, this.vec.y + this.tb.coord.y, this.vec.z + this.tb.coord.z);
        return this.tb.position.get(this.vec);
    }
    set position(value) {
        if(value) return this.tb.position.set(this.vec, value);
        this.tb.position.delete(this.vec);
    }
    get metadata() {
        return this.tb.metadata.get(this.vec);
    }

    getSound() {
        let sound = null;
        if(this.id) {
            let mat = this.material;
            sound = mat.hasOwnProperty('sound') ? mat.sound : null;
        }
        return sound;
    }

    isPlant() {
        return this.material.planting;
    }

    canReplace() {
        return BLOCK.canReplace(this.id, this.extra_data);
    }

    hasTag(tag) {
        let mat = this.material;
        return mat.tags && mat.tags.indexOf(tag) >= 0;
    }

}

// TypedBlocks
export class TypedBlocks {

    constructor(coord) {
        this.coord      = coord;
        this.count      = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
        this.buffer     = new ArrayBuffer(this.count * 2);
        this.id         = new Uint16Array(this.buffer, 0, this.count);
        this.power      = new VectorCollector();
        this.rotate     = new VectorCollector();
        this.entity_id  = new VectorCollector();
        this.texture    = new VectorCollector();
        this.extra_data = new VectorCollector();
        this.vertices   = new VectorCollector();
        this.falling    = new VectorCollector();
        this.shapes     = new VectorCollector();
        this.metadata   = new VectorCollector();
        this.position   = new VectorCollector();
    }
    /**
     * Creating iterator that fill target block to reduce allocations 
     * NOTE! This unsafe because returned block will be re-filled in iteration process
     * @param {TBlock} target 
     * @returns 
     */
    createUnsafeIterator(target = null) {
        const b = target || new TBlock(this, new Vector());
        const contex = this;

        return (function* () {
            for(let index = 0; index < contex.count; index++) {
                if (!contex.id[index]) {
                    continue;
                }

                // let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
                let x = index % CHUNK_SIZE_X;
                let y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
                let z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
                let vec = b.vec.set(x, y, z);


                yield b.init(contex, vec);//new TBlock(this, vec);
            }
        })()
    }

    *[Symbol.iterator]() {
        for(let index = 0; index < this.count; index++) {
            // let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
            let x = index % CHUNK_SIZE_X;
            let y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
            let z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
            let vec = new Vector(x, y, z);
            yield new TBlock(this, vec);
        }
    }

    delete(vec) {
        let block           = this.get(vec);
        block.id            = null;
        block.power         = 0;
        block.rotate        = null;
        block.entity_id     = null;
        block.texture       = null;
        block.extra_data    = null;
        block.vertices      = null;
        block.falling       = null;
        block.shapes        = null;
        block.position      = null;
    }

    /**
     * Get or fill block by it pos
     * @param {Vector} vec 
     * @param {TBlock} block 
     * @returns 
     */
    get(vec, block = null) {
        return block 
            ? block.init(this, vec) 
            : new TBlock(this, vec);
    }

    has(vec) {
        let index = BLOCK.getIndex(vec);
        return this.id[index] > 0;
    }

}
