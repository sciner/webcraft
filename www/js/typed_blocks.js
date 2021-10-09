import {Vector, VectorCollector} from "./helpers.js";
import {BLOCK, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "./blocks.js";

export class TBlock {

    constructor(tb, vec) {
        this.tb = tb;
        this.vec = vec;
        this.index = BLOCK.getIndex(vec);
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
        return this.tb.power.get(this.vec);
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

    // properties
    get properties() {
        return BLOCK.BLOCK_BY_ID[this.id] || null;
    }

}

// TypedBlocks
export class TypedBlocks {

    constructor() {
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
    }

    get(vec) {
        return new TBlock(this, vec);
    }

    has(vec) {
        let index = BLOCK.getIndex(vec);
        return this.id[index] > 0;
    }

}