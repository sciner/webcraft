import {AABB} from './AABB.js'
import {Vector} from "../helpers";

const tempPos = new Vector();

export class BaseChunk {
    constructor({size}) {
        this.initSize(size);
        this.outerAABB = new AABB();
        this.pos = new Vector();
        this.subRegions = [];
        this.subMaxWidth = 0;
    }

    initSize(size) {
        const padding = this.padding = 1;
        this.size = size;
        const outerSize = this.outerSize = new Vector(size.x + padding * 2, size.y + padding * 2, size.z + padding * 2);
        this.aabb = new AABB();
        this.aabb.x_max = size.x - 1;
        this.aabb.y_max = size.y - 1;
        this.aabb.z_max = size.z - 1;
        this.outerLen = outerSize.x * outerSize.y * outerSize.z;
        this.innerLen = size.x * size.y * size.z;
        this.outerAABB = new AABB();
        this.outerAABB.x_max = outerSize.x - 1;
        this.outerAABB.y_max = outerSize.y - 1;
        this.outerAABB.z_max = outerSize.z - 1;
    }

    /**
     *
     * @param {Vector} pos
     * @returns {BaseChunk}
     */
    setPos(pos) {
        const {size, padding} = this;
        this.pos.copyFrom(pos);
        this.aabb.set(pos.x, pos.y, pos.z, pos.x + size.x - 1, pos.y + size.y - 1, pos.z + size.z - 1);
        this.outerAABB.set(pos.x - padding, pos.y - padding, pos.z - padding,
            pos.x + size.x + padding * 2 - 1, pos.y + size.y + padding * 2 - 1, pos.z + size.z + padding * 2 - 1);
        return this;
    }

    addSub(sub) {
        const {subRegions} = this;
        let i = 0, len = subRegions.length;
        for (; i < len; i++) {
            if (subRegions[i].x > sub.x) {
                break;
            }
        }
        for (let j = len - 1; j >= i; j--) {
            subRegions[j + 1] = subRegions[j];
        }
        subRegions[i] = sub;
    }

    subByWorld(worldCoord) {
        const {subRegions} = this;
        const {x, y, z, subMaxWidth} = worldCoord;
        // find left good
        let left = 0, right = subRegions.length;
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].x_min + subMaxWidth < x) {
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
            if (subRegions[mid].x_min <= x) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let R = right;

        for (let i = L; i < R; i++) {
            const sub = subRegions[i];
            if (sub.x_min <= x && x <= sub.x_max
                && sub.y_min <= y && y <= sub.y_max
                && sub.z_min <= y && y <= sub.z_max) {
                return sub;
            }
        }
        return null;
    }

    /**
     *
     * @param {number} outerCoord
     */
    subByOuter(outerCoord) {

    }
}
