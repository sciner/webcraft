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

    _addPortals() {
        const {subRegions, subMaxWidth} = this.dataChunk;
        let left = 0, right = subRegions.length;
        const {x_min, x_max, y_min, y_max, z_min, z_max} = this.outerAABB;

        // easy binary search part 2
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].x_min + subMaxWidth <= x_min) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let L = right;
        left = L;
        right = subRegions.length;
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].x_min <= x_max) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let R = right;

        for (let i = L; i < R; i++) {
            const second = subRegions[i];
            if (second === this) {
                continue;
            }
            const aabb = subRegions[i].aabb;
            if (aabb.x_min <= x_max && x_min <= aabb.x_max
                && aabb.y_min <= y_max && y_min <= aabb.y_max
                && aabb.z_min <= z_max && z_min <= aabb.z_max) {
                const aabb = new AABB().setIntersect(this.outerAABB, second.outerAABB);
                const portal1 = new Portal({
                    aabb,
                    fromRegion: this,
                    toRegion: second
                })
                const portal2 = new Portal({
                    aabb,
                    fromRegion: second,
                    toRegion: this
                })
                portal1.rev = portal2;
                portal2.rev = portal1;
                this.portals.push(portal1);
                second.portals.push(portal2);
            }
        }
    }

    _removePortals() {
        for (let portal of this.portals) {
            const { rev } = portal;
            const ind = rev.fromRegion.portals.indexOf(rev);
            if (ind >= 0) {
                rev.fromRegion.portals.splice(ind, 1);
            } else {
                // WTF?
            }
        }
        this.portals.length = 0;
    }
}

export class Portal {
    constructor({ aabb, fromRegion, toRegion }) {
        this.aabb = aabb;
        this.fromRegion = fromRegion;
        this.toRegion = toRegion;
    }
}
