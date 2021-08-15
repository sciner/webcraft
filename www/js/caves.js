import {impl as alea} from '../../vendors/alea.js';
import {Vector, SpiralGenerator} from "./helpers.js";

// Cave...
export class Cave {

    // Constructor
    constructor(seed, addr) {
        this.alea       = new alea(seed + addr.toString());
        this.head_pos   = null;
        this.coord      = addr.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
        this.points     = [];
        //
        let index = this.alea.double();
        // проверяем нужно или нет начало пещеры в этом чанке
        if(index < .1) {
            // общее количество блоков в чанке
            let block_count = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
            // генерируем абсолютную позицию начала пещеры в этом чанке
            index = parseInt(block_count * .05 + this.alea.double() * block_count * .4);
            // конвертируем позицию в 3D вектор
            this.head_pos = addr.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z)).add(new Vector(
                index % CHUNK_SIZE_X,
                parseInt(index / (CHUNK_SIZE_X * CHUNK_SIZE_Z)),
                parseInt((index % (CHUNK_SIZE_X + CHUNK_SIZE_Z)) / CHUNK_SIZE_X)
            ));
        }
    }

}

// CaveGenerator...
export class CaveGenerator {

    constructor(seed) {
        this.seed           = typeof seed != 'undefined' ? seed : 'default_seed'; // unique world seed
        this.caves          = {};
        this.margin         = 8;
        this.spiral_moves   = SpiralGenerator.generate(this.margin);
    }

    // add
    add(chunk_addr) {
        chunk_addr = new Vector(chunk_addr.x, chunk_addr.y, chunk_addr.z);
        let key = chunk_addr.toString();
        if(typeof this.caves[key] == 'undefined') {
            this.caves[key] = new Cave(this.seed, chunk_addr);
        }
        return this.caves[key];
    }

    // get
    get(chunk_addr) {
        chunk_addr = new Vector(chunk_addr.x, chunk_addr.y, chunk_addr.z);
        let key = chunk_addr.toString();
        return this.caves[key];
    }

    // addSpiral
    addSpiral(chunk_addr) {
        chunk_addr = new Vector(chunk_addr.x, chunk_addr.y, chunk_addr.z);
        this.add(chunk_addr.add(new Vector(0, 0, 0)));
        for(let sm of this.spiral_moves) {
            this.add(chunk_addr.add(sm));
        }
    }

}