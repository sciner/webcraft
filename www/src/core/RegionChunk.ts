import {Vector} from "../helpers.js";
import {BaseChunk} from "./BaseChunk.js";

export class RegionChunk extends BaseChunk {
    [key: string]: any;
    constructor({size, dataChunk}) {
        super(size);
        this.dataChunk = dataChunk;
        this.pos = new Vector();
        this.dataPos = new Vector();
    }

    setPos(pos : Vector) : BaseChunk {
        this.pos.copyFrom(pos);
        const { outerAABB } = this.dataChunk;
        this.dataPos.copyFrom(pos);
        this.dataPos.x -= outerAABB.x_min;
        this.dataPos.y -= outerAABB.y_min;
        this.dataPos.z -= outerAABB.z_min;
        return this
    }

    uint32ByCoord(localX, localY, localZ, offset = 0) {
        const { outerSize, stride32, uint32View } = this.dataChunk;
        const { dataPos } = this;
        localX += dataPos.x
        localY += dataPos.y
        localZ += dataPos.z
        return uint32View[offset + stride32 * (localX  + outerSize.x * (localZ + localY * outerSize.z))];
    }

}