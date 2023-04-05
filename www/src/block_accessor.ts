import {Vector} from "./helpers/vector.js";
import {BLOCK} from "./blocks.js";
import {TBlock} from "./typed_blocks3.js";
import {CH_SZ_X, CH_SZ_Y, CH_SZ_Z} from "./chunk_const";

//TODO: find a use for it
//TODO: remove CHUNK_SIZE
//TODO: fix for non-pow-2 CHUNK_SIZE

const CHUNK_PADDING = 1;
// See also BaseChunk.initSize(), Vector.fromChunkIndex(), Vector.yFromChunkIndex()
const CHUNK_SIZE_X_M1                = CH_SZ_X - 1;
const CHUNK_SIZE_Y_M1                = CH_SZ_Y - 1;
const CHUNK_SIZE_Z_M1                = CH_SZ_Z - 1;
const CHUNK_SIZE                     = CH_SZ_X * CH_SZ_Y * CH_SZ_Z;

const CHUNK_OUTER_SIZE_X = CH_SZ_X + 2 * CHUNK_PADDING;
const CHUNK_OUTER_SIZE_Y = CH_SZ_Y + 2 * CHUNK_PADDING;
const CHUNK_OUTER_SIZE_Z = CH_SZ_Z + 2 * CHUNK_PADDING;
const CHUNK_CX = 1;
const CHUNK_CY = CHUNK_OUTER_SIZE_X * CHUNK_OUTER_SIZE_Z;
const CHUNK_CZ = CHUNK_OUTER_SIZE_X;
const CHUNK_SIZE_OUTER = CHUNK_CY * CHUNK_OUTER_SIZE_Y;
/* It's faster for generating chunks, but currently breaks meshing
const CHUNK_CY = 1;
const CHUNK_CZ = CHUNK_OUTER_SIZE_Y;
const CHUNK_CX = CHUNK_OUTER_SIZE_Y * CHUNK_OUTER_SIZE_Z;
*/
const CHUNK_CW = CHUNK_PADDING * (CHUNK_CX + CHUNK_CY + CHUNK_CZ);

const tmp_BlockAccessor_Vector = new Vector();

/**
 * A class that provides access to the world blocks in the same area
 * on average as fast as the chunk does to its own blocks.
 *
 * It caches the current chunk, so its instances can't be stored and reused
 * for any prolonged time; it must be re-created, or reset by calling init().
 */
export class BlockAccessor {
    [key: string]: any;

    /**
     * @param {World} world
     * @param {Vector, TBlock or BlockAccessor} initial - optional. Some point near the area
     *   where the class will be used. If it's provided, it slightly speeds up initialization.
     *   Passing {@link TBlock} or {@link BlockAccessor} is preferable.
     */
    constructor(world, initial = null) {
        this.chunkManager = world.chunkManager || world.chunks;
        if (initial instanceof BlockAccessor) {
            this._tmpTbCoord = initial._tmpTbCoord.clone();
            this._vec = initial._vec.clone();
            this._tmpTBlock = new TBlock(initial._tmpTBlock._tb, this._vec, initial._tmpTBlock.index);
            this._tbCoord = initial._tbCoord ? this._tmpTbCoord : null;
            this.tblockOrNull = initial.tblockOrNull ? this._tmpTBlock : null;
        } else {
            this._tmpTbCoord = new Vector(); // used for this._tbCoord when this._tb is absent
            if (initial instanceof TBlock) {
                this._vec = initial.vec.clone();
                this._tmpTBlock = new TBlock(initial.tb, this._vec, initial.index);
                this._tbCoord = initial.tb.coord; // TypedBlocks3.coord taht is present even if _tb == null
                this.tblockOrNull = this._tmpTBlock; // either this._tmpTBlock or null
            } else {
                this._vec = new Vector(); // relative to this._tbCoord
                this._tmpTBlock = new TBlock(null, this._vec, 1);
                if (initial) { // assume it to be a Vector-like object
                    this._rebase(initial.x, initial.y, initial.z);
                } else {
                    this._rebase(0, 0, 0);
                }
            }
        }
    }

    /**
     * Allows a persistent refernce to the class to be used again.
     * It solves the problem of the remembered chunk being unloaded.
     *
     * @param {Vector, TBlock or BlockAccessor} initial - optional. Some point near the area
     *   where the class will be used. If it's provided, it slightly speeds up initialization.
     *   Passing {@link TBlock} or {@link BlockAccessor} is preferable.
     */
    init(initial = null) {
        if (initial instanceof BlockAccessor) {
            this._tmpTbCoord.copyFrom(initial._tmpTbCoord);
            this._vec.copyFrom(initial._vec);
            this._tmpTBlock.tb = initial._tb;
            this._tbCoord = initial._tbCoord ? this._tmpTbCoord : null;
            this.tblockOrNull = initial.tblockOrNull ? this._tmpTBlock : null;
        } else if (initial instanceof TBlock) {
            this._vec.copyFrom(initial.vec);
            this._tmpTBlock.tb = initial.tb;
            this._tbCoord = initial.tb.coord;
            this.tblockOrNull = this._tmpTBlock;
        } else if (initial) { // assume it to be a Vector-like object
            this._rebase(initial.x, initial.y, initial.z);
        } else {
            this._rebase(0, 0, 0);
        }
    }

    /**
     * @returns { int } world coordinate X of the current point.
     */
    get x() {
        return this._tbCoord.x + this._vec.x;
    }

    get y() {
        return this._tbCoord.y + this._vec.y;
    }

    get z() {
        return this._tbCoord.z + this._vec.z;
    }

    /**
     * @returns {Vector} a clone of the current world position.
     */
    posClone() {
        return this._vec.clone().addSelf(this._tbCoord);
    }

    /**
     * Sets the world coordinat X of the current position.
     * @param { int } x
     */
    set x(x) {
        const rx = x - this._tbCoord.x;
        if ((rx | CHUNK_SIZE_X_M1 - rx) >= 0) { // if (rx >= 0 && rx <= CHUNK_SIZE_X_M1)
            this._tmpTBlock.index += CHUNK_CX * (rx - this._vec.x);
            this._vec.x = rx;
            return;
        }
        this._rebase(x, this.y, this.z);
    }

    set y(y) {
        const ry = y - this._tbCoord.y;
        if ((ry | CHUNK_SIZE_Y_M1 - ry) >= 0) { // if (ry >= 0 && ry <= CHUNK_SIZE_Y_M1)
            this._tmpTBlock.index += CHUNK_CY * (ry - this._vec.y);
            this._vec.y = ry;
            return;
        }
        this._rebase(this.x, y, this.z);
    }

    set z(z) {
        const rz = z - this._tbCoord.z;
        if ((rz | CHUNK_SIZE_Z_M1 - rz) >= 0) { // if (rz >= 0 && rz <= CHUNK_SIZE_Z_M1)
            this._tmpTBlock.index += CHUNK_CZ * (rz - this._vec.z);
            this._vec.z = rz;
            return;
        }
        this._rebase(this.x, this.y, z);
    }

    /**
     * Sets the current world position.
     * @param { int } x
     * @param { int } y
     * @param { int } z
     * @returns {BlockAccessor} this
     */
    setXYZ(x, y, z) {
        let c = this.tblocksCoord;
        if (c !== null) {
            // x and y are more likely to be outside the range, so check them together and first
            const rx = x - this._tbCoord.x;
            const rz = z - this._tbCoord.z;
            if ((rx | rz | CHUNK_SIZE_X_M1 - rx | CHUNK_SIZE_Z_M1 - rz) >= 0) {
                const ry = y - this._tbCoord.y;
                if ((ry | CHUNK_SIZE_Y_M1 - ry) >= 0) {
                    this._setRelPos(rx, ry, rz);
                    return this;
                }
            }
        }
        this._rebase(x, y, z);
        return this;
    }

    /**
     * Sets the current world position.
     * @param {Vector} vec
     * @returns {BlockAccessor} this
     */
    setVec(vec) {
        return this.setXYZ(vec.x, vec.y, vec.z);
    }

    /**
     * Adds to the coordinates of the current world position.
     * @param { int } dx
     * @param { int } dy
     * @param { int } dz
     * @returns {BlockAccessor} this
     */
    addXYZ(dx, dy, dz) {
        return this.setXYZ(this.x + dx, this.y + dy, this.z + dz);
    }

    /**
     * @returns { int } id of the current block, or null if the chunk is not generated.
     */
    get idOrNull() {
        return this.tblockOrNull?.id;
    }

    /**
     * @param {Any} def - the default value
     * @returns { int } id of the current block, or the default value if the chunk is not generated.
     */
    idOr(def) {
        return this.tblockOrNull ? this.tblockOrNull.id : def;
    }

    /**
     * @returns { object } the properties of the current block, or null if the chunk is not generated.
     */
    get materialOrNull() {
        return this.tblockOrNull?.material;
    }

    /**
     * @returns { object } the properties of the current block, or {@link BLOCK.DUMMY}
     *      if the chunk is not generated.
     */
    get materialOrDUMMY() {
        return this.tblockOrNull?.material ?? BLOCK.DUMMY;
    }

    /**
     * @param {Any} def - the default value
     * @returns { object } the properties of the current block, or the default value
     *      if the chunk is not generated.
     */
    materialOr(def) {
        return this.tblockOrNull?.material ?? def;
    }

    /**
     * @returns {TBlock} vurrent tblock, or chunkManager.DUMMY if the chunk is not generated.
     *      Note: the same instance is reused and it can't rememberd for any prolonged time.
     *      It's valid only unil the position changes.
     */
    get tblockOrDummy() {
        return this.tblockOrNull ?? this.chunkManager.DUMMY;
    }

    _setRelPos(rx, ry, rz) {
        this._vec.setScalar(rx, ry, rz);
        this._tmpTBlock.index = rx * CHUNK_CX + ry * CHUNK_CY + rz * CHUNK_CZ + CHUNK_CW;
    }

    _rebase(x: int, y: int, z: int) {
        const grid = this.chunkManager.grid
        const addr = grid.getChunkAddr(x, y, z, tmp_BlockAccessor_Vector);
        const cliSrvCompatbility = this.chunkManager.chunks || this.chunkManager;
        // This accounts both for missing chunks, and for blocks not generated
        let tb = cliSrvCompatbility.get(addr)?.tblocks;

        if (tb) {
            this._tbCoord = tb.coord;
            this.tblockOrNull = this._tmpTBlock;
            this.tblockOrNull.tb = tb;
        } else {
            grid.chunkAddrToCoord(addr, this._tmpTbCoord)
            this._tbCoord = this._tmpTbCoord;
            this.tblockOrNull = null;
        }
        this._setRelPos(x - this._tbCoord.x, y - this._tbCoord.y, z - this._tbCoord.z);
    }
}