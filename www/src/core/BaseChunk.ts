import {AABB} from './AABB.js'
import {Vector} from "../helpers.js";
import type {ChunkGrid} from "./ChunkGrid.js";
import type {DataChunk} from "./DataChunk";

const tempAABB = new AABB();

export class BaseChunk {
    cx: int
    cy: int
    cz: int
    cw: int
    size: Vector
    aabb: AABB
    grid: ChunkGrid | null

    outerAABB = new AABB();
    safeAABB = new AABB();
    pos = new Vector();
    portals: Array<Portal> = [];
    facetPortals: Array<Portal> = [];
    padding: number;
    outerLen: number;
    insideLen: number;
    shiftCoord: number;

    subRegions: Array<BaseChunk> = null;
    subMaxWidth = 0;
    dif26: number[];
    outerSize: Vector;
    markDeleteId = 0;
    lastOpID = -1;

    /**
     * actual chunk here
     * //TODO: type it
     */
    rev: any = null;

    constructor({grid = null as ChunkGrid, size = null, nibble = null}) {
        this.grid = grid;
        this.initSize(size || grid.chunkSize);
        this.setPos(Vector.ZERO);
        this.dif26 = [];

        if (nibble) {
            this.initNibble(nibble);
        } else {
            this.clearNibble();
        }
    }

    initSize(size: Vector) {
        const padding = this.padding = 1;
        this.size = size;
        const outerSize = this.outerSize = new Vector(size.x + padding * 2, size.y + padding * 2, size.z + padding * 2);
        this.aabb = new AABB();
        this.outerLen = outerSize.x * outerSize.y * outerSize.z;
        this.insideLen = size.x * size.y * size.z;
        this.outerAABB = new AABB();
        this.safeAABB = new AABB();
        this.shiftCoord = 0;

        this.cx = this.grid.math.cx;
        this.cy = this.grid.math.cy;
        this.cz = this.grid.math.cz;
        this.cw = this.grid.math.cw;
    }

    getStrides(): TBlockStrides {
        return [this.cx, this.cy, this.cz, this.cw]
    }

    nibbleDims: Vector;
    nibbleStrideBytes: number;
    nibbleSize: Vector;
    nibbleOuterSize: Vector;
    nibbleOuterLen: number;

    clearNibble() {
        this.nibbleDims = null;
        this.nibbleStrideBytes = 0;
        this.nibbleSize = null;
        this.nibbleOuterSize = null;
        this.nibbleOuterLen = 0;
    }

    initNibble({dims, strideBytes}) {
        const {padding} = this;

        this.nibbleDims = dims;
        this.nibbleStrideBytes = strideBytes;
        this.nibbleSize = new Vector(Math.ceil(this.size.x / dims.x),
            Math.ceil(this.size.y / dims.y),
            Math.ceil(this.size.z / dims.z));

        const outerSize = this.nibbleOuterSize = new Vector().copyFrom(this.nibbleSize).addScalarSelf(padding * 2, padding * 2, padding * 2);
        this.nibbleOuterLen = outerSize.x * outerSize.y * outerSize.z;
    }

    setPos(pos: Vector): BaseChunk {
        const {size, padding, outerSize} = this;
        this.pos.copyFrom(pos);
        this.aabb.set(pos.x, pos.y, pos.z, pos.x + size.x, pos.y + size.y, pos.z + size.z);
        const outer = this.outerAABB.copyFrom(this.aabb).pad(padding);
        this.safeAABB.copyFrom(this.aabb).pad(-1);
        this.shiftCoord = -(outer.x_min + outerSize.x * (outer.z_min + outerSize.z * outer.y_min));
        return this;
    }

    addSub(sub : BaseChunk) {
        if (this.grid) {
            this.grid.addSub(sub as any);
            return;
        }
        if (!this.subRegions) {
            this.subRegions = [];
        }
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
        if (this.grid) {
            this.grid.removeSub(sub as any);
            return;
        }
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
     * @param {number} outerCoord
     */
    subByOuter(outerCoord: number) {
    }

    _addPortal(portal) {
        this.portals.push(portal);

        const inner = this.safeAABB;
        const {aabb, toRegion} = portal;

        const nibbleSize1 = this.nibbleSize;
        const nibbleSize2 = toRegion.nibbleSize;

        let nibbleCompatibleX = false;
        let nibbleCompatibleY = false;
        let nibbleCompatibleZ = false;
        if (nibbleSize1 && nibbleSize2) {
            //TODO: check corner nibble
            nibbleCompatibleX = nibbleSize1.x === nibbleSize2.x && (this.aabb.x_min - toRegion.aabb.x_min) % nibbleSize1.x === 0
            nibbleCompatibleY = nibbleSize1.y === nibbleSize2.y && (this.aabb.y_min - toRegion.aabb.y_min) % nibbleSize1.y === 0
            nibbleCompatibleZ = nibbleSize1.z === nibbleSize2.z && (this.aabb.z_min - toRegion.aabb.z_min) % nibbleSize1.z === 0
        }
        if (aabb.x_max - aabb.x_min === 2) {
            portal.nibbleCompatible = nibbleCompatibleY && nibbleCompatibleZ;
        } else if (aabb.y_max - aabb.y_min === 2) {
            portal.nibbleCompatible = nibbleCompatibleX && nibbleCompatibleZ;
        } else if (aabb.z_max - aabb.z_min === 2) {
            portal.nibbleCompatible = nibbleCompatibleX && nibbleCompatibleY;
        }

        if (portal.isFacet) {
            this.facetPortals.push(portal);
        }

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

    /**
     * kill all portals to regions that have markDeleteId
     * calls portalHandler for every deleted portal
     * @param portalHandler
     */
    cleanPortals(portalHandler?: (Portal) => void) {
        const {portals, facetPortals} = this;
        let j = 0;
        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            if (portal.toRegion.markDeleteId) {
                if (portalHandler) {
                    portalHandler(portal);
                }
            } else {
                portals[j++] = portal;
            }
        }
        if (portals.length === j) {
            return;
        }
        portals.length = j;
        j = 0;
        for (let i = 0; i < facetPortals.length; i++) {
            if (facetPortals[i].toRegion.markDeleteId) {
            } else {
                facetPortals[j++] = facetPortals[i];
            }
        }
        facetPortals.length = j;
    }

    _removeAllPortals() {
        for (let i = 0; i < this.portals.length; i++) {
            const portal = this.portals[i];
            const {rev} = portal;
            let ind = rev.fromRegion.portals.indexOf(rev);
            if (ind >= 0) {
                rev.fromRegion.portals.splice(ind, 1);
            } else {
                // WTF?
            }
            if (portal.isFacet) {
                ind = rev.fromRegion.facetPortals.indexOf(rev);
                if (ind >= 0) {
                    rev.fromRegion.facetPortals.splice(ind, 1);
                }
            }
        }
        this.portals.length = 0;
        this.facetPortals.length = 0;
    }
}

export class Portal {
    fromRegion: DataChunk;
    toRegion: DataChunk;
    rev: Portal;
    aabb: AABB;
    volume: number;
    nibbleCompatible = false;
    isFacet: boolean;

    constructor({aabb, fromRegion, toRegion}) {
        this.aabb = aabb;
        this.volume = (aabb.x_max - aabb.x_min) * (aabb.y_max - aabb.y_min) * (aabb.z_max - aabb.z_min);
        this.fromRegion = fromRegion;
        this.toRegion = toRegion;

        let facet = 0;
        if (aabb.x_max - aabb.x_min > 2) {
            facet++;
        }
        if (aabb.y_max - aabb.y_min > 2) {
            facet++;
        }
        if (aabb.z_max - aabb.z_min > 2) {
            facet++;
        }
        this.isFacet = facet >= 2;
    }
}
