import {impl as alea} from '../../vendors/alea.js';
import {Vector, SpiralGenerator} from "./helpers.js";

export class Cave {

    // Constructor
    constructor(chunk) {
        this.alea       = new alea(chunk.seed + '_' + chunk.id);
        this.pos        = null;
        this.points     = [];
        let index = this.alea.double();
        // проверяем нужно или нет начало пещеры в этом чанке
        if(index < .1) {
            // общее количество блоков в чанке
            let block_count = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
            // генерируем абсолютную позицию начала пещеры в этом чанке
            index = parseInt(block_count * .1 + this.alea.double() * block_count * .8);
            // конвертируем позицию в 3D вектор
            this.pos = new Vector(
                index % CHUNK_SIZE_X,
                parseInt(index / (CHUNK_SIZE_X * CHUNK_SIZE_Z)),
                parseInt(index / CHUNK_SIZE_X),
            );
        }
    }

}

export class CaveGenerator {

    constructor() {
        this.list = [];
    }

    add(chunk) {
        this.list.push(new Cave(chunk));
    }

}