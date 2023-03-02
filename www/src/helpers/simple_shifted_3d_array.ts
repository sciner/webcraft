/** A 3D array (backed by an Array or a typed array) whose bottom-left corner may differ from (0,0,0). */
export class SimpleShifted3DArray {
    [key: string]: any;
    minX: any;
    minY: any;
    minZ: any;
    sizeX: any;
    sizeY: any;
    sizeZ: any;
    sizeXM1: number;
    sizeYM1: number;
    sizeZM1: number;
    maxX: any;
    maxY: any;
    maxZ: any;
    arr: any[];
    lengthM1: number;
    strideX: number;
    strideY: any;
    strideZ: number;

    constructor(minX, minY, minZ, sizeX, sizeY, sizeZ, arrayClass = Array) {
        this.minX = minX
        this.minY = minY
        this.minZ = minZ
        this.sizeX = sizeX
        this.sizeY = sizeY
        this.sizeZ = sizeZ
        this.sizeXM1 = sizeX - 1
        this.sizeYM1 = sizeY - 1
        this.sizeZM1 = sizeZ - 1
        this.maxX = minX + this.sizeXM1
        this.maxY = minY + this.sizeYM1
        this.maxZ = minZ + this.sizeZM1
        this.arr = new arrayClass(sizeX * sizeY * sizeZ)
        this.lengthM1 = this.arr.length - 1
        this.strideX = sizeZ * sizeY
        this.strideY = sizeZ
        this.strideZ = 1
    }

    fill(v) {
        this.arr.fill(v)
        return this
    }

    has(x, y, z) {
        return x >= this.minX && y >= this.minY && z >= this.minZ &&
            x <= this.maxX && y <= this.maxY && z <= this.maxZ
    }

    toIndOrNull(x, y, z) {
        x -= this.minX
        y -= this.minY
        z -= this.minZ
        return x >= 0 && y >= 0 && z >= 0 && x <= this.sizeXM1 && y <= this.sizeYM1 && z <= this.sizeZM1
            ? x * this.strideX + y * this.strideY + z
            : null
    }

    vecToIndOrNull(vec) {
        return this.toIndOrNull(vec.x, vec.y, vec.z)
    }

    toInd(x, y, z) {
        x -= this.minX
        y -= this.minY
        z -= this.minZ
        if ((x | y | z | (this.sizeXM1 - x) | (this.sizeYM1 - y) | (this.sizeZM1 - z)) < 0) {
            throw new Error()
        }
        return x * this.strideX + y * this.strideY + z
    }

    vecToInd(vec) {
        return this.toInd(vec.x, vec.y, vec.z)
    }

    getByInd(ind) {
        if ((ind | (this.lengthM1 - ind)) < 0) {
            throw new Error()
        }
        return this.arr[ind]
    }

    get(x, y, z) {
        return this.arr[this.toInd(x, y, z)]
    }

    getByVec(vec) {
        return this.arr[this.toInd(vec.x, vec.y, vec.z)]
    }

    setByInd(ind, v) {
        if ((ind | (this.lengthM1 - ind)) < 0) {
            throw new Error()
        }
        this.arr[ind] = v
    }

    set(x, y, z, v) {
        this.arr[this.toInd(x, y, z)] = v
    }

    setByVec(vec, v) {
        this.arr[this.toInd(vec.x, vec.y, vec.z)] = v
    }

    shift(dx, dy, dz, fill) {
        if ((dx | dy | dz) === 0) {
            return false
        }
        this.minX += dx
        this.maxX += dx
        this.minY += dy
        this.maxY += dy
        this.minZ += dz
        this.maxZ += dz
        if (Math.abs(dx) >= this.sizeX || Math.abs(dy) >= this.sizeY || Math.abs(dz) >= this.sizeZ) {
            this.arr.fill(fill)
            return true
        }
        let x0, x2, ax, y0, y2, ay, z0, z2, az
        if (dx > 0) {
            x0 = 0
            x2 = this.sizeX
            ax = 1
        } else {
            x0 = this.sizeXM1
            x2 = -1
            ax = -1
        }
        const x1 = x2 - dx
        if (dy > 0) {
            y0 = 0
            y2 = this.sizeY
            ay = 1
        } else {
            y0 = this.sizeYM1
            y2 = -1
            ay = -1
        }
        const y1 = y2 - dy
        if (dz > 0) {
            z0 = 0
            z2 = this.sizeZ
            az = 1
        } else {
            z0 = this.sizeZM1
            z2 = -1
            az = -1
        }
        const z1 = z2 - dz

        const d = dx * this.strideX + dy * this.strideY + dz
        for(let x = x0; x != x1; x += ax) {
            const ix = x * this.strideX
            for(let y = y0; y != y1; y += ay) {
                const iy = ix + y * this.strideY
                for(let z = z0; z != z1; z += az) {
                    // copy the elemets
                    const iz = iy + z
                    this.arr[iz] = this.arr[iz + d]
                }
                // fill uncopied elements
                for(let z = z1; z != z2; z += az) {
                    this.arr[iy + z] = fill
                }
            }
            // fill uncopied elements
            for(let y = y1; y != y2; y += ay) {
                const iy = ix + y * this.strideY
                for(let z = z0; z != z2; z += az) {
                    this.arr[iy + z] = fill
                }
            }
        }
        // fill uncopied elements
        for(let x = x1; x != x2; x += ax) {
            const ix = x * this.strideX
            for(let y = y0; y != y2; y += ay) {
                const iy = ix + y * this.strideY
                for(let z = z0; z != z2; z += az) {
                    this.arr[iy + z] = fill
                }
            }
        }

        return true
    }

    /**
     * Yields [x, y, z, ind, value]
     * For now, values outside the array are not supported, and behavior for them is undefined.
     */
    *xyzIndValues(minX = this.minX, maxX = this.maxX, minY = this.minY, maxY = this.maxY, minZ = this.minZ, maxZ = this.maxZ) {
        const entry = [null, null, null, null, null]
        for(let x = minX; x <= maxX; x++) {
            const ix = (x - this.minX) * this.strideX
            entry[0] = x
            for(let y = minY; y <= maxY; y++) {
                const iyp = ix + (y - this.minY) * this.strideY - this.minZ
                entry[1] = y
                for(let z = minZ; z <= maxZ; z++) {
                    const iz = iyp + z
                    entry[2] = z
                    entry[3] = iz
                    entry[4] = this.arr[iz]
                    yield entry
                }
            }
        }
    }

    *values() {
        yield *this.arr
    }
}
