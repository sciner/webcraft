import type {Vector} from "../helpers/vector.js";
import {Mth} from "../helpers/mth.js";

const MIN_BLOCKS_PER_SECOND = 0.1
const PERIOD = 100

/**
 * It logs information about player's speed over time.
 * It's only for debug. It can be removed safely later.
 */
export class PlayerSpeedLogger {

    private firstPos    : Vector | null = null
    private prevPos     : Vector | null = null
    private prevTime    : number
    private speeds      : number[] = []
    private accumulatedTime     = 0
    private accumulatedDistance = 0

    reset() {
        this.speeds.length = 0
        this.accumulatedTime = 0
        this.accumulatedDistance = 0
        this.firstPos = null
    }

    add(pos: Vector) {
        const now = performance.now()
        if (!this.prevPos) {
            this.prevPos = pos.clone()
            this.prevTime = now
            return
        }

        const deltaTime = now - this.prevTime
        this.prevTime = now
        if (!deltaTime) {
            return
        }

        const dist = pos.distance(this.prevPos)
        this.prevPos.copyFrom(pos)

        const blocksPerSecond = dist / (deltaTime * 0.001)
        const moved = blocksPerSecond >= MIN_BLOCKS_PER_SECOND
        if (moved) {
            this.firstPos ??= pos.clone()
            this.accumulatedTime += deltaTime
            this.accumulatedDistance += dist
            const periods = Math.floor(this.accumulatedTime / PERIOD)
            if (periods) {
                const usedDuration = periods * PERIOD
                const usedDistance = this.accumulatedDistance * usedDuration / this.accumulatedTime
                const hadSpeed = Mth.round(usedDistance / (usedDuration * 0.001), 2)
                for(let i = 0; i < periods; i++) {
                    this.speeds.push(hadSpeed)
                }
                this.accumulatedTime        -= usedDuration
                this.accumulatedDistance    -= usedDistance
            }
        } else if (this.speeds.length || this.accumulatedTime) {
            const hadSpeed = Mth.round(this.accumulatedDistance / (PERIOD * 0.001), 2)
            this.speeds.push(hadSpeed)
            const deltaPos = pos.sub(this.firstPos).roundSelf(1)
            const length = Mth.round(deltaPos.length(), 1)
            console.log(`Total movement: ${deltaPos}; ${length} blocks. Blocks/sec in each ${PERIOD} ms interval:`, JSON.stringify(this.speeds))
            this.reset()
        }
    }
}