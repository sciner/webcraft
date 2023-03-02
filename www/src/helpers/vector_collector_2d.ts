import {ShiftedMatrix} from "./shifted_matrix.js";

/** Similar to {@link VectorCollector}, but for 2D coordinates. */
export class VectorCollector2D {

    byRow: Map<int, any>

    constructor() {
        this.byRow  = new Map()
    }

    isEmpty()  { return this.byRow.size === 0 }

    /**
     * It's relatively slow. Use {@link isEmpty} if possible.
     * We don't maintain size filed, because it's rarely needed, but makes modifications slower.
     */
    getSize() {
        let size = 0
        for(const byCol of this.byRow.values()) {
            size += byCol.size
        }
        return size
    }

    set(row, col, value) {
        let byCol = this.byRow.get(row)
        if (!byCol) {
            byCol = new Map()
            this.byRow.set(row, byCol)
        }
        byCol.set(col, value)
    }

    get(row, col) {
        return this.byRow.get(row)?.get(col)
    }

    delete(row, col) {
        let byCol = this.byRow.get(row)
        if (byCol) {
            byCol.delete(col)
            if (byCol.size === 0) {
                this.byRow.delete(row)
            }
        }
    }

    /**
     * Updates a value (existing or non-existng), possibly setting it or deleting it.
     * It's faster than getting and then setting a value.
     * @param {int} row
     * @param {int} col
     * @param {Function} mapFn is called for the existing value (or undefined, if there is no value).
     *   If its result is not null, it's set as the new value.
     *   If its result is null, the value is deleted.
     * @return the new value.
     */
    update(row, col, mapFn) {
        let byCol = this.byRow.get(row)
        const oldV = byCol?.get(col)
        const newV = mapFn(oldV)
        if (newV != null) {
            if (newV !== oldV) {
                if (!byCol) {
                    byCol = new Map()
                    this.byRow.set(row, byCol)
                }
                byCol.set(col, newV)
            }
        } else {
            if (byCol) {
                byCol.delete(col)
                if (byCol.size === 0) {
                    this.byRow.delete(row)
                }
            }
        }
        return newV
    }

    *values() {
        for (const byCol of this.byRow.values()) {
            yield *byCol.values()
        }
    }

    *keys() {
        const entry = [0, 0]
        for (const [row, byCol] of this.byRow) {
            entry[0] = row
            for (const col of byCol.keys()) {
                entry[1] = col
                yield entry
            }
        }
    }

    *entries() {
        const entry = [0, 0, null]
        for (const [row, byCol] of this.byRow) {
            entry[0] = row
            for (const [col, value] of byCol) {
                entry[1] = col
                entry[2] = value
                yield entry
            }
        }
    }

    /**
     * Sets min (inclusive) and max (exclusive) values of coordintes to fields of {@link dst}
     * object. The field names are derived from {@link prefixRow}, {@link prefixRow} and suffixes '_min' and '_max'.
     */
    calcBounds(prefixRow = 'row', prefixCol = 'col', dst = {}) {
        let minCol = Infinity
        let maxCol = -Infinity
        let minRow = Infinity
        let maxRow = -Infinity
        for (const [row, byCol] of this.byRow) {
            if (minRow > row) minRow = row
            if (maxRow < row) maxRow = row
            for (const col of byCol.keys()) {
                if (minCol > col) minCol = col
                if (maxCol < col) maxCol = col
            }
        }
        dst[prefixRow + '_min'] = minRow
        dst[prefixRow + '_max'] = maxRow + 1
        dst[prefixCol + '_min'] = minCol
        dst[prefixCol + '_max'] = maxCol + 1
        return dst
    }

    toMatrix(pad = 0, emptyValue = null, arrayClass = Array) {
        if (this.isEmpty()) {
            return null
        }
        const aabb = this.calcBounds() as any
        const mat = ShiftedMatrix.createMinMaxPad(aabb.row_min, aabb.col_min,
            aabb.row_max, aabb.col_max, pad, arrayClass)
        if (emptyValue !== null) {
            mat.fill(emptyValue)
        }
        for(const [row, col, value] of this.entries()) {
            mat.set(row, col, value)
        }
        return mat
    }
}
