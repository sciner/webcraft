import { FLUID_STRIDE, FLUID_TYPE_MASK, OFFSET_FLUID, FLUID_LEVEL_MASK } from "./FluidConst.js";
import { Vector } from "../helpers.js";

const FLOWING_DIFF_TYPE_MASK_SHL = 2

export class FluidChunkFlowing {
    [key: string]: any;

    constructor(fluidChunk) {
        this.fluidChunk = fluidChunk
        this.lastQueryId = null

        /**
         * A Map of changes of floing blocks since the last call of
         * {@link startTrackingAndSendFlowing} or {@link _sendFlowingDiff}. The keys are indices.
         * The values contain:
         * - in bits {@link FLUID_TYPE_MASK} the type of a flowing fluid (0 - no flowing fluid).
         * - in bits ({@link FLUID_TYPE_MASK} << {@link FLOWING_DIFF_TYPE_MASK_SHL}) - the value that was before the current diff.
         *   These previous values are internal and should be ignored by the end-user of the changes.
         */
        this.diffByIndex = new Map()

        /** All flowing fluid blocks, in the same format as {@link diffByIndex} */
        this.byIndex = new Map()

        // build the initial data
        const {cx, cy, cz, cw, size} = fluidChunk.dataChunk
        const {uint8View} = fluidChunk
        for (let y = 0; y < size.y; y++) {
            for (let z = 0; z < size.z; z++) {
                let index = y * cy + z * cz + cw
                for (let x = 0; x < size.x; x++) {
                    const v = uint8View[index * FLUID_STRIDE + OFFSET_FLUID]
                    if (v & FLUID_LEVEL_MASK) {
                        this.byIndex.set(index, v & FLUID_TYPE_MASK)
                    }
                    index += cx
                }
            }
        }
    }

    sendAll(queryId) {
        if (this.lastQueryId === queryId) {
            return // skip repeated queries for the same sound chunk placeholder
        }
        this.lastQueryId = queryId

        // we're sending everything, so the diff should be cleared
        this.diffByIndex.clear()

        Qubatch.game.sounds.volumetric.onFlowingDiff({
            addr: this.fluidChunk.parentChunk.addr,
            map: this.byIndex,
            all: true
        })
    }

    sendDiff() {
        if (this.diffByIndex.size) {
            Qubatch.game.sounds.volumetric.onFlowingDiff({
                addr: this.fluidChunk.parentChunk.addr,
                map: this.diffByIndex
            })
            this.diffByIndex = new Map()
        }
    }

    /**
     * It checks that the flowing type has changed. If it has, it updates the map of flowing blocks.
     * @param { int } index - block index, non-flat
     * @param { int } value - the new fluid value
     * @param { int } prev - the previous fluid value
     */
    updateByIndexFluid(index, value, prev) {
        const newFlowing = value & FLUID_LEVEL_MASK
            ? value & FLUID_TYPE_MASK
            : 0
        const prevFlowing = prev & FLUID_LEVEL_MASK
            ? prev & FLUID_TYPE_MASK
            : 0
        if (newFlowing !== prevFlowing) {
            this.updateByIndexDiff(index, newFlowing, prevFlowing)
        }
    }

    /**
     * Unlike {@link updateByIndexFluid}, it doesn't check that the vaue has chenged, but it's a bit faster.
     * @param { int } index - block index, non-flat
     * @param { int } newFlowing - the new value that contains only bits in {@link FLUID_TYPE_MASK}, only if the fluid is flowing
     * @param { int } prevFlowing - the previous value that contains only bits in {@link FLUID_TYPE_MASK}
     */
    updateByIndexDiff(index, newFlowing, prevFlowing) {
        const oldDiff = this.diffByIndex.get(index)
        if (oldDiff == null) {
            const newDiff = newFlowing | (prevFlowing << FLOWING_DIFF_TYPE_MASK_SHL)
            this.diffByIndex.set(index, newDiff)
        } else {
            const oldFlowing = (oldDiff >> FLOWING_DIFF_TYPE_MASK_SHL) & FLUID_TYPE_MASK
            if (newFlowing !== oldFlowing) {
                const newDiff = newFlowing | (oldFlowing << FLOWING_DIFF_TYPE_MASK_SHL)
                this.diffByIndex.set(index, newDiff)
            } else {
                // there have been multiple changes, and in the end we set the same value as before the diff was created
                this.diffByIndex.delete(index)
            }
        }
        if (newFlowing) {
            this.byIndex.set(index, newFlowing)
        } else {
            this.byIndex.delete(index)
        }
    }

    deleteBoundsY(y_min, y_max) {
        this._delete(index => {
            const y = Vector.yFromChunkIndex(index)
            return y >= y_min && y <= y_max
        })
    }

    /**
     * Changes {@link diffByIndex} and {@link byIndex} as if all
     * flowing blocks filtered by {@link filterIndex} are deleted.
     */
    _delete(filterIndex = () => ture) {
        const SHIFTED_MASK = FLUID_TYPE_MASK << FLOWING_DIFF_TYPE_MASK_SHL
        for (const [index, diff] of this.diffByIndex) {
            if (!filterIndex(index)) {
                continue
            }
            const old = diff & SHIFTED_MASK
            if (old === 0) {
                this.diffByIndex.delete(index)
            } else if ((diff & FLUID_TYPE_MASK) !== 0) {
                this.diffByIndex.set(old)
            }
        }
        for (const index of this.byIndex.keys()) {
            if (filterIndex(index)) {
                this.byIndex.delete(index)
            }
        }
    }
}