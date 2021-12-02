import { AABB } from './AABB.js'
import {Vector} from "../helpers";
import {BaseChunk} from "./BaseChunk";

export class DataChunk extends BaseChunk {
    constructor({size, strideBytes}) {
        super(size);
        this.initData(strideBytes);
    }

    initData(strideBytes) {
        this.strideBytes = strideBytes;
        this.stride32 = strideBytes >> 2;
        this.stride16 = strideBytes >> 1;
        this.dataBuf = new ArrayBuffer(this.outerLen * strideBytes);
        this.uint16View = new Uint16Array(this.dataBuf);
        this.uint32View = new Uint32Array(this.dataBuf);
    }
}
