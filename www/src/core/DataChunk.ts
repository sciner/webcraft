import type { Vector } from "../helpers.js";
import {BaseChunk} from "./BaseChunk.js";

export class DataChunk extends BaseChunk {
    [key: string]: any;

    constructor({size, strideBytes, nibble} : {size : Vector, strideBytes : int, nibble? : any}) {
        super({size, nibble});
        this.initData(strideBytes);
    }

    initData(strideBytes : int) {
        this.strideBytes = strideBytes;
        this.stride32 = strideBytes >> 2;
        this.stride16 = strideBytes >> 1;
        this.dataBuf = new ArrayBuffer(this.outerLen * strideBytes);
        this.uint8View = new Uint8Array(this.dataBuf);
        if ((strideBytes & 1) === 0) {
            this.uint16View = new Uint16Array(this.dataBuf);
        }
        if ((strideBytes & 3) === 0) {
            this.uint32View = new Uint32Array(this.dataBuf);
        }
        this.dataView = new DataView(this.dataBuf);

        if (this.nibbleSize) {
            this.nibbleBuf = new ArrayBuffer(this.nibbleStrideBytes * this.nibbleOuterLen)
            this.nibbles = new Uint8Array(this.nibbleBuf);
        } else {
            this.nibbleBuf = null;
            this.nibbles = null;
        }
    }

    setFromArrayBuffer(buf) {
        // only not-padded data
        if (buf.byteLength !== this.strideBytes * this.insideLen) {
            throw new Error('Wrong data size');
        }
        let { outerSize, size, padding, strideBytes, stride32, uint8View, uint32View } = this;
        if (uint32View) {
            const data = new Uint32Array(buf);
            const amount = size.x * stride32;
            for (let y = 0; y < size.y; y++) {
                for (let z = 0; z < size.z; z++) {
                    const indFrom = (y * size.z + z) * size.x * stride32;
                    const indTo = (((y + padding) * outerSize.z + (z + padding)) * outerSize.x + padding) * strideBytes;
                    for (let x = 0; x < amount; x++) {
                        this.uint32View[indTo + x] = data[indFrom + x];
                    }
                }
            }
        } else {
            const data = new Uint8Array(buf);
            const amount = size.x * strideBytes;
            for (let y = 0; y < size.y; y++) {
                for (let z = 0; z < size.z; z++) {
                    const indFrom = (y * size.z + z) * size.x * strideBytes;
                    const indTo = (((y + padding) * outerSize.z + (z + padding)) * outerSize.x + padding) * strideBytes;
                    for (let x = 0; x < amount; x++) {
                        this.uint8View[indTo + x] = data[indFrom + x];
                    }
                }
            }
        }
    }

    uint32ByCoord(localX, localY, localZ, offset = 0) {
        const { outerSize, padding, stride32, uint32View } = this;
        localX += padding
        localY += padding
        localZ += padding
        return uint32View[offset + stride32 * (localX  + outerSize.x * (localZ + localY * outerSize.z))];
    }

    uint16ByCoord(localX, localY, localZ, offset = 0) {
        const { outerSize, padding, stride16, uint16View } = this;
        localX += padding
        localY += padding
        localZ += padding
        return uint16View[offset + stride16 * (localX  + outerSize.x * (localZ + localY * outerSize.z))];
    }

    indexByWorld(worldX, worldY, worldZ) {
        const { outerSize } = this;
        return worldX + outerSize.x * (worldZ + outerSize.z * worldY) + this.shiftCoord;
    }
    setUint32ByCoord(localX, localY, localZ, offset, value) {
        const { outerSize, padding, stride32, uint32View } = this;
        localX += padding
        localY += padding
        localZ += padding
        uint32View[offset + stride32 * (localX  + outerSize.x * (localZ + localY * outerSize.z))] = value;
    }

    uint8ByInd(ind, offset) {
        return this.uint8View[ind * this.strideBytes + offset];
    }

    setUint8ByInd(ind, offset, value) {
        this.uint8View[ind * this.strideBytes + offset] = value;
    }

    setUint32ByInd(ind, offsetBytes, value) {
        this.dataView.setUint32(ind * this.strideBytes + offsetBytes, value, true);
    }
}
