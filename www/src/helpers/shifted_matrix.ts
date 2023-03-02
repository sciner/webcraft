import {ArrayHelpers} from "./array_helpers.js";
import {SimpleQueue} from "./simple_queue.js";

/**
 * A matrix that has indices in [minRow..(minRow + rows - 1), minCol..(minCol + cols - 1)]
 */
export class ShiftedMatrix {
    minRow: int;
    minCol: int;
    rows: int;
    cols: int;
    rowsM1: int;
    colsM1: int;
    arr: any[];

    // For each shift, we compute the distance. Shifts that are multiple of each other are not used.
    // It's used to compute approximate cartesian distances (to achieve more natural, rounded corners).
    static _MAX_SHIFT = 3
    static _SHIFTS_BY_DELTA_ROW = ArrayHelpers.create(2 * ShiftedMatrix._MAX_SHIFT + 1, i => [])
    static initStatics() { // init shifts
        const shifts = [0,1, 0,-1, 1,0, -1,0, -1,-1, -1,1, 1,-1, 1,1]
        function add(dRow, dCol) {
            const len = Math.sqrt(dRow * dRow + dCol * dCol)
            ShiftedMatrix._SHIFTS_BY_DELTA_ROW[dRow + ShiftedMatrix._MAX_SHIFT].push(dCol, len)
        }
        for(let i = 0; i < shifts.length; i++) {
            add(shifts[i], shifts[++i])
        }
        for(let i = 2; i <= ShiftedMatrix._MAX_SHIFT; i++) {
            for(let j = 1; j < i; j++) {
                for(let si = -1; si <= 1; si += 2 ) {
                    for(let sj = -1; sj <= 1; sj += 2 ) {
                        add(i * si, j * sj)
                        add(j * sj, i * si)
                    }
                }
            }
        }
    }

    constructor(minRow, minCol, rows, cols, arrayClass = Array) {
        this.init(minRow, minCol, rows, cols, new arrayClass(rows * cols))
    }

    init(minRow, minCol, rows, cols, arr = null) {
        this.minRow = minRow
        this.minCol = minCol
        this.rows = rows
        this.cols = cols
        this.rowsM1 = rows - 1
        this.colsM1 = cols - 1
        this.arr = arr ?? ArrayHelpers.ensureCapacity(this.arr, rows * cols)
        return this
    }

    initHorizontalInAABB(aabb) {
        return this.init(aabb.x_min, aabb.z_min, aabb.width, aabb.depth)
    }

    static createHorizontalInAABB(aabb, arrayClass = Array) {
        return new ShiftedMatrix(aabb.x_min, aabb.z_min, aabb.width, aabb.depth, arrayClass)
    }

    static createMinMaxPad(minRow, minCol, maxRow, maxCol, pad = 0, arrayClass = Array) {
        return new ShiftedMatrix(minRow - pad, minCol - pad,
            maxRow - minRow + 2 * pad, maxCol - minCol + 2 * pad, arrayClass)
    }

    // Exclusive, like in AABB
    get maxRow() { return this.minRow + this.rows }
    get maxCol() { return this.minCol + this.cols }
    get size()   { return this.rows * this.cols }

    /** Creates a mtarix with the same size and coordinates as this. */
    createAligned(arrayClass = Array) {
        return new ShiftedMatrix(this.minRow, this.minCol, this.rows, this.cols, arrayClass)
    }

    fill(v) {
        this.arr.fill(v, 0, this.size);
        return this;
    }

    get(row, col) {
        row -= this.minRow;
        col -= this.minCol;
        if ((row | col | (this.rowsM1 - row) | (this.colsM1 - col)) < 0) {
            throw new Error();
        }
        return this.arr[row * this.cols + col];
    }

    getOrDefault(row, col, def = null) {
        row -= this.minRow;
        col -= this.minCol;
        if ((row | col | (this.rowsM1 - row) | (this.colsM1 - col)) < 0) {
            return def;
        }
        return this.arr[row * this.cols + col];
    }

    set(row, col, v) {
        row -= this.minRow;
        col -= this.minCol;
        if ((row | col | (this.rowsM1 - row) | (this.colsM1 - col)) < 0) {
            throw new Error();
        }
        this.arr[row * this.cols + col] = v;
        return v;
    }

    has(row, col) {
        row -= this.minRow
        col -= this.minCol
        return (row | col | (this.rowsM1 - row) | (this.colsM1 - col)) >= 0
    }

    hasRow(row) {
        row -= this.minRow
        return (row | (this.rowsM1 - row)) >= 0
    }

    hasCol(col) {
        col -= this.minCol
        return (col | (this.colsM1 - col)) >= 0
    }

    /**
     * Iterates over all elements, or over an area intersectign with the given aabb.
     * @param {?Int} minRow - inclusive
     * @param {?Int} minCol - inclusive
     * @param {?Int} maxRow - exclusive
     * @param {?Int} maxCol - exclusive
     * @yields {Array} [row, col, value]
     */
    *entries(minRow = null, minCol = null, maxRow = null, maxCol = null) {
        if (minCol == null) {
            minRow = this.minRow
            maxRow = this.maxRow
            minCol = this.minCol
            maxCol = this.maxCol
        } else {
            minRow = Math.max(minRow, this.minRow)
            maxRow = Math.min(maxRow, this.maxRow)
            minCol = Math.max(minCol, this.minCol)
            maxCol = Math.min(maxCol, this.maxCol)
        }
        const entry = [0, 0, 0]
        for(let i = minRow; i < maxRow; i++) {
            let ind = (i - this.minRow) * this.cols + (minCol - this.minCol)
            entry[0] = i
            for(let j = minCol; j < maxCol; j++) {
                entry[1] = j
                entry[2] = this.arr[ind]
                yield entry
                ind++
            }
        }
    }

    /**
     * @yields {Array} [row, col, index], where row is from 0 to this.rows - 1, and col is from  0 to this.cols - 1
     */
    *relativeRowColIndices() {
        const entry = [0, 0, 0]
        const cols = this.cols
        for(let i = 0; i < this.rows; i++) {
            let ind = i * cols
            entry[0] = i
            for(let j = 0; j < cols; j++) {
                entry[1] = j
                entry[2] = ind
                yield entry
                ind++
            }
        }
    }

    *rowColIndices() {
        const entry = [0, 0, 0]
        const cols = this.cols
        for(let i = 0; i < this.rows; i++) {
            let ind = i * cols
            entry[0] = i + this.minRow
            for(let j = 0; j < cols; j++) {
                entry[1] = j + this.minCol
                entry[2] = ind
                yield entry
                ind++
            }
        }
    }

    toArrayOfArrays() {
        let res = [];
        for(let i = 0; i < this.rows; i++) {
            const s = [];
            for(let j = 0; j < this.cols; j++) {
                s.push(this.arr[i * this.cols + j]);
            }
            res.push(s);
        }
        return res;
    }

    transformEach(fn) {
        const arr = this.arr
        for(let i = 0; i < arr.length; i++) {
            arr[i] = fn(arr[i])
        }
    }

    /**
     * Casts "rays" parallel to the sides that pass through rejected by {@link isNotEmpty},
     * and fills all the elements that are not "illuminated" by the rays with {@link value}.
     */
    fillInsides(value = 1, isNotEmpty = (it) => it) {
        const arr = this.arr
        const cols = this.cols
        for(let i = 0; i < this.rows; i++) {
            const ind0 = i * cols
            // find the 1st non-empty element in the row
            for(let jb = 0; jb < cols; jb++) {
                const indB = ind0 + jb
                if (isNotEmpty(arr[indB])) {
                    let ind = ind0 + (cols - 1)
                    // find the last non-empty element
                    while(!isNotEmpty(arr[ind])) {
                        ind--
                    }
                    while(ind >= indB) {
                        arr[ind] = value
                        ind--
                    }
                    break
                }
            }
        }
        for(let j = 0; j < this.cols; j++) {
            // find the 1st non-empty element in the column
            for(let ib = 0; ib < this.rows; ib++) {
                const indB = j + cols * ib
                if (isNotEmpty(arr[indB])) {
                    let ind = j + cols * (this.rows - 1)
                    // find the last non-empty element
                    while(!isNotEmpty(arr[ind])) {
                        ind -= cols
                    }
                    while(ind >= indB) {
                        arr[ind] = value
                        ind -= cols
                    }
                    break
                }
            }
        }
    }

    /** Creates a new matrix, or fills {@link dst} with values of this matrix, transformed by {@link fn} */
    map(fn = (it) => it, dst = null, arrayClass = Array) {
        if (dst && (dst.rows !== this.rows || dst.cols !== this.cols)) {
            throw new Error()
        }
        dst = dst ?? new ShiftedMatrix(this.minRow, this.minCol, this.rows, this.cols, arrayClass)
        for(let ind = 0; ind < this.arr.length; ind++) {
            dst.arr[ind] = fn(this.arr[ind])
        }
        return dst
    }

    /**
     * Initially some area must be filled with 0, and the rest with Infinity.
     * For each cell filled with Infinity, it computes approximate distance to the
     * closest cell filled with 0. If {@link toOutside} == true, the cells outside the
     * matrix are considered to be 0.
     */
    calcDistances(toOutside = false, tmpArray = null, tmpQueue = null) {

        function add(row, col, ind) {
            queue.push(row)
            queue.push(col)
            tmpArray[ind] = 1
        }

        function spread(row0, col0, ind, v0) {
            // don't spread to the side that already has smaller values
            const minRow = row0 > 0 && arr[ind - cols] >= v0
                ? Math.max(row0 - ShiftedMatrix._MAX_SHIFT, 0)
                : row0
            const maxRow = row0 < rowsM1 && arr[ind + cols] >= v0
                ? Math.min(row0 + ShiftedMatrix._MAX_SHIFT, rowsM1)
                : row0
            for(let row = minRow; row <= maxRow; row++) {
                const ind0 = row * cols
                let byRow = ShiftedMatrix._SHIFTS_BY_DELTA_ROW[row - row0 + ShiftedMatrix._MAX_SHIFT]
                for(let i = 0; i < byRow.length; i += 2) {
                    const col = col0 + byRow[i]
                    if (col >= 0 && col < cols) {
                        const ind = ind0 + col
                        const v = v0 + byRow[i + 1]
                        if (arr[ind] > v) {
                            arr[ind] = v
                        }
                    }
                }
            }
        }

        if (tmpArray) {
            tmpArray.fill(0, 0, this.size)
        } else {
            tmpArray = new Uint8Array(this.size)
        }
        const queue = tmpQueue ?? new SimpleQueue()

        const cols = this.cols
        const rowsM1 = this.rows - 1
        const colsM1 = cols - 1
        const arr = this.arr
        // add border cells to the queue, spread from inner cells
        for(const [row, col, ind] of this.relativeRowColIndices()) {
            const v = arr[ind]
            if (v) { // it's a cell with an unkown distance, a queue candidate
                const onBorder =
                    (row === 0      ? toOutside : arr[ind - cols] === 0) ||
                    (row === rowsM1 ? toOutside : arr[ind + cols] === 0) ||
                    (col === 0      ? toOutside : arr[ind - 1]    === 0) ||
                    (col === colsM1 ? toOutside : arr[ind + 1]    === 0)
                if (onBorder) {
                    add(row, col, ind)
                }
            } else {    // it's a cell with known 0 distance; spread from some of them
                const hasNonZeroNeigbours =
                    row          && arr[ind - cols] ||
                    row < rowsM1 && arr[ind + cols] ||
                    col          && arr[ind - 1] ||
                    col < colsM1 && arr[ind + 1]
                if (hasNonZeroNeigbours) {
                    spread(row, col, ind, v)
                }
            }
        }
        // do wide search
        while(queue.length) {
            const row = queue.shift()
            const col = queue.shift()
            const ind = row * cols + col
            spread(row, col, ind, arr[ind])
            if (row > 0 && !tmpArray[ind - cols]) {
                add(row - 1, col, ind - cols)
            }
            if (row < rowsM1 && !tmpArray[ind + cols]) {
                add(row + 1, col, ind + cols)
            }
            if (col > 0 && !tmpArray[ind - 1]) {
                add(row, col - 1, ind - 1)
            }
            if (col < colsM1 && !tmpArray[ind + 1]) {
                add(row, col + 1, ind + 1)
            }
        }
        return this
    }
}

ShiftedMatrix.initStatics()
