import { AABB } from './AABB.js'
import {Vector} from "../helpers";
import {BaseChunk} from "./BaseChunk";

export class RegionChunk extends BaseChunk {
    constructor({size, dataChunk}) {
        super(size);
        this.dataChunk = dataChunk;
        this.pos = new Vector();
        this.dataPos = new Vector();
        this.portals = [];
    }

    setPos(pos) {
        this.pos.copyFrom(pos);
        const { outerAABB } = this.dataChunk;
        this.dataPos.copyFrom(pos);
        this.dataPos.x -= outerAABB.x_min;
        this.dataPos.y -= outerAABB.y_min;
        this.dataPos.z -= outerAABB.z_min;
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

export class Portal {
    constructor({ aabb, toRegion }) {
        this.aabb = aabb;
        this.toRegion = toRegion;
    }
}
