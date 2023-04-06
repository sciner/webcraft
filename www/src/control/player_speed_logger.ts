import {Vector} from "../helpers/vector.js";
import {Mth} from "../helpers/mth.js";

const MIN_BLOCKS_PER_SECOND = 0.1
/**
 * non-zero value is the averaging period in ms
 * 0 means 1 value per call (if it's called every frame = 1 value per frame). Note that frame durations vary!
 */
const PERIOD = 100
const MAX_LENGTH = 1000
const LOG_AFTER_STOP_PERIOD = 200

export const enum PlayerSpeedLoggerMode { DISABLED, SCALAR, Y, XYZ }

type TXyzTuple = [x: float, y: float, z: float]

/**
 * It logs information about player's speed over time.
 * It's only for debug. It can be removed safely later.
 */
export class PlayerSpeedLogger {

    private mode        : PlayerSpeedLoggerMode
    private modeXYZ     : boolean
    private firstPos    : Vector | null
    private prevPos     : Vector | null
    private tmpPos      = new Vector()
    private prevTime    : number
    private speeds      : (number | TXyzTuple)[] = []
    private accumulatedTime     = 0
    private accumulatedDistance : float
    private accumulatedDistanceXYZ = new Vector()
    private lastMovedTime       : float

    constructor(mode = PlayerSpeedLoggerMode.SCALAR) {
        this.mode = mode
        this.modeXYZ = mode === PlayerSpeedLoggerMode.XYZ
        this.reset()
    }

    reset() {
        this.speeds.length = 0
        this.accumulatedTime = 0
        this.accumulatedDistance = 0
        this.accumulatedDistanceXYZ.zero()
        this.firstPos = null
        this.prevPos = null
        this.lastMovedTime = -Infinity
    }

    /**
     * @returns true if anything has been added to the log or printed
     */
    add(pos: Vector): boolean {
        if (this.mode === PlayerSpeedLoggerMode.DISABLED) {
            return false
        }
        const now = performance.now()
        if (!this.prevPos) {
            this.prevPos = pos.clone()
            this.prevTime = now
            return false
        }

        const deltaTime = now - this.prevTime
        this.prevTime = now
        if (!deltaTime) {
            return false
        }

        const distXYZ = pos.clone().subSelf(this.prevPos)
        let dist: float
        switch(this.mode) {
            case PlayerSpeedLoggerMode.SCALAR:
            case PlayerSpeedLoggerMode.XYZ:
                dist = distXYZ.length()
                break
            case PlayerSpeedLoggerMode.Y:
                dist = distXYZ.y
                break
        }
        this.prevPos.copyFrom(pos)

        const blocksPerSecond = dist / (deltaTime * 0.001)
        if (blocksPerSecond >= MIN_BLOCKS_PER_SECOND) {
            this.lastMovedTime = now
        }
        if (this.lastMovedTime >= now - LOG_AFTER_STOP_PERIOD) {
            this.firstPos ??= pos.clone()
            this.accumulatedTime += deltaTime
            if (this.modeXYZ) {
                this.accumulatedDistanceXYZ.addSelf(distXYZ)
            } else {
                this.accumulatedDistance += dist
            }
            const periods = PERIOD
                ? Math.floor(this.accumulatedTime / PERIOD)
                : (this.accumulatedTime ? 1 : 0)
            if (periods) {
                const usedDuration = periods * PERIOD || this.accumulatedTime
                const hadSpeed = this.calcSpeed(usedDuration)
                for(let i = 0; i < periods; i++) {
                    this.speeds.push(hadSpeed)
                }
                this.accumulatedTime -= usedDuration
                if (this.speeds.length >= MAX_LENGTH) {
                    this.log(pos)
                    this.firstPos.copyFrom(pos)
                }
            }
            return true
        } else if (this.firstPos) {
            this.accumulatedTime = PERIOD || this.accumulatedTime
            if (this.accumulatedTime) {
                const hadSpeed = this.calcSpeed(this.accumulatedTime)
                this.speeds.push(hadSpeed)
            }
            this.log(pos)
            this.reset()
            return true
        } else {
            return false
        }
    }

    private calcSpeed(usedDuration: float): float | TXyzTuple {
        let res: float | TXyzTuple
        if (this.modeXYZ) {
            const usedDistanceXYZ = this.accumulatedDistanceXYZ.mulScalar(usedDuration / this.accumulatedTime)
            res = usedDistanceXYZ.mulScalar(1 / (usedDuration * 0.001))
                .round(2).toArray() as TXyzTuple
            this.accumulatedDistanceXYZ.subSelf(usedDistanceXYZ)
        } else {
            const usedDistance = this.accumulatedDistance * usedDuration / this.accumulatedTime
            res = Mth.round(usedDistance / (usedDuration * 0.001), 2)
            this.accumulatedDistance    -= usedDistance
        }
        return res
    }

    private log(currentPos: Vector) {
        const deltaPos = this.tmpPos.copyFrom(currentPos).sub(this.firstPos).roundSelf(1)
        const length = Mth.round(deltaPos.length(), 1)
        const periodStr = PERIOD ? `${PERIOD} ms interval` : `frame`
        console.log(`Total movement: ${deltaPos}; ${length} blocks. Blocks/sec in each ${periodStr}:`, JSON.stringify(this.speeds))
        this.speeds.length = 0
    }
}