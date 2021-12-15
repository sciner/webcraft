import {AABB} from './AABB.js'
import {Vector} from "../helpers.js";

const tempAABB = new AABB();

export class BaseChunk {
    constructor({size}) {
        this.outerAABB = new AABB();
        this.safeAABB = new AABB();
        this.pos = new Vector();
        this.subRegions = [];
        this.subMaxWidth = 0;
        this.portals = [];
        this.initSize(size);
        this.setPos(Vector.ZERO);
        this.dif26 = [];
    }

    initSize(size) {
        const padding = this.padding = 1;
        this.size = size;
        const outerSize = this.outerSize = new Vector(size.x + padding * 2, size.y + padding * 2, size.z + padding * 2);
        this.aabb = new AABB();
        this.outerLen = outerSize.x * outerSize.y * outerSize.z;
        this.insideLen = size.x * size.y * size.z;
        this.outerAABB = new AABB();
        this.safeAABB = new AABB();
        this.shiftCoord = 0;
    }

    /**
     *
     * @param {Vector} pos
     * @returns {BaseChunk}
     */
    setPos(pos) {
        const {size, padding, outerSize} = this;
        this.pos.copyFrom(pos);
        this.aabb.set(pos.x, pos.y, pos.z, pos.x + size.x, pos.y + size.y, pos.z + size.z);
        const outer = this.outerAABB.copyFrom(this.aabb).pad(padding);
        this.safeAABB.copyFrom(this.aabb).pad(-1);
        this.shiftCoord = -(outer.x_min + outerSize.x * (outer.z_min + outerSize.z * outer.y_min));
        return this;
    }

    addSub(sub) {
        const {subRegions} = this;
        const x = sub.aabb.x_min;
        let i = 0, len = subRegions.length;
        for (; i < len; i++) {
            if (subRegions[i].aabb.x_min > x) {
                break;
            }
        }
        for (let j = len - 1; j >= i; j--) {
            subRegions[j + 1] = subRegions[j];
        }
        subRegions[i] = sub;

        this.subMaxWidth = Math.max(this.subMaxWidth, sub.aabb.x_max - sub.aabb.x_min);
        sub._addPortalsForBase(this);
    }

    removeSub(sub) {
        let ind = this.subRegions.indexOf(sub);
        if (ind >= 0) {
            sub._removeAllPortals();
            this.subRegions.splice(ind, 1);
        }
    }

    subByWorld(worldCoord) {
        const {subRegions, subMaxWidth} = this;
        const {x, y, z} = worldCoord;
        // easy binary search part 1
        let left = 0, right = subRegions.length;
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].aabb.x_min + subMaxWidth < x) {
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
            if (subRegions[mid].aabb.x_min <= x) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let R = right;

        for (let i = L; i < R; i++) {
            const sub = subRegions[i].aabb;
            if (sub.x_min <= x && x <= sub.x_max
                && sub.y_min <= y && y <= sub.y_max
                && sub.z_min <= z && z <= sub.z_max) {
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

    _addPortal(portal) {
        this.portals.push(portal);

        const inner = this.safeAABB;
        const aabb = portal.aabb;
        tempAABB.setIntersect(inner, aabb);
        if (tempAABB.isEmpty()) {
            return;
        }
        if (tempAABB.width <= tempAABB.height && tempAABB.width <= tempAABB.depth) {
            if (inner.x_min < aabb.x_min && inner.x_max <= aabb.x_max) {
                inner.x_max = aabb.x_min;
            } else {
                inner.x_min = aabb.x_max;
            }
        } else if (tempAABB.height <= tempAABB.width && tempAABB.height <= tempAABB.depth) {
            if (inner.y_min < aabb.y_min) {
                inner.y_max = aabb.y_min;
            } else {
                inner.y_min = aabb.y_max;
            }
        } else {
            if (inner.z_min < aabb.z_min) {
                inner.z_max = aabb.z_min;
            } else {
                inner.z_min = aabb.z_max;
            }
        }
    }

    _addPortalsForBase(baseChunk) {
        const {subRegions, subMaxWidth} = baseChunk;
        let left = -1, right = subRegions.length;
        const {x_min, x_max, y_min, y_max, z_min, z_max} = this.aabb;

        // easy binary search part 2
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].aabb.x_min + subMaxWidth < x_min) {
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
            if (subRegions[mid].aabb.x_min <= x_max) {
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
            const neib = subRegions[i].aabb;
            if (neib.x_min <= x_max && x_min <= neib.x_max
                && neib.y_min <= y_max && y_min <= neib.y_max
                && neib.z_min <= z_max && z_min <= neib.z_max) {
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
                this._addPortal(portal1);
                second._addPortal(portal2);
            }
        }
    }

    _removeAllPortals() {
        for (let portal of this.portals) {
            const {rev} = portal;
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
    constructor({aabb, fromRegion, toRegion}) {
        this.aabb = aabb;
        this.fromRegion = fromRegion;
        this.toRegion = toRegion;
    }
}
