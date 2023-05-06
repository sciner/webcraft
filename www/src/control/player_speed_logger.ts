import {Vector} from "../helpers/vector.js";
import {Mth} from "../helpers/mth.js";

const MIN_BLOCKS_PER_SECOND = 0.1
/**
 * non-zero value is the averaging period in ms
 * 0 means 1 value per call (if it's called every frame = 1 value per frame). Note that frame durations vary!
 */
const PERIOD = 0
const MAX_LENGTH = 1000
const LOG_AFTER_STOP_PERIOD = 200
const LOG_SPEED_DECIMALS = 2
const LOG_COORD_DECIMALS = 3
const USE_PHYS_POS = true

export const enum PlayerSpeedLoggerMode { DISABLED, SPEED_SCALAR, SPEED_Y, SPEED_XYZ, COORD_XYZ }

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
    private logEntries  : (number | TXyzTuple)[] = []
    private accumulatedTime     = 0
    private accumulatedDistance : float
    private accumulatedDistanceXYZ = new Vector()
    private lastMovedTime       : float

    constructor(mode = PlayerSpeedLoggerMode.SPEED_SCALAR) {
        this.mode = mode
        this.modeXYZ = (mode === PlayerSpeedLoggerMode.SPEED_XYZ || mode === PlayerSpeedLoggerMode.COORD_XYZ)
        this.reset()
    }

    reset() {
        this.logEntries.length = 0
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
    add(physPos: Vector, lerpPos: Vector): boolean {
        if (this.mode === PlayerSpeedLoggerMode.DISABLED) {
            return false
        }
        const pos = USE_PHYS_POS ? physPos : lerpPos
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
            case PlayerSpeedLoggerMode.SPEED_SCALAR:
            case PlayerSpeedLoggerMode.SPEED_XYZ:
            case PlayerSpeedLoggerMode.COORD_XYZ:
                dist = distXYZ.length()
                break
            case PlayerSpeedLoggerMode.SPEED_Y:
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
                const logEntry = this.calcLogEntry(usedDuration)
                for(let i = 0; i < periods; i++) {
                    this.logEntries.push(logEntry)
                }
                this.accumulatedTime -= usedDuration
                if (this.logEntries.length >= MAX_LENGTH) {
                    this.log(pos)
                    this.firstPos.copyFrom(pos)
                }
            }
            return true
        } else if (this.firstPos) {
            this.accumulatedTime = PERIOD || this.accumulatedTime
            if (this.accumulatedTime) {
                const logEntry = this.calcLogEntry(this.accumulatedTime)
                this.logEntries.push(logEntry)
            }
            this.log(pos)
            this.reset()
            return true
        } else {
            return false
        }
    }

    private calcLogEntry(usedDuration: float): float | TXyzTuple {
        let res: float | TXyzTuple
        if (this.mode === PlayerSpeedLoggerMode.SPEED_XYZ) {
            const usedDistanceXYZ = this.accumulatedDistanceXYZ.mulScalar(usedDuration / this.accumulatedTime)
            res = usedDistanceXYZ.mulScalar(1 / (usedDuration * 0.001))
                .round(LOG_SPEED_DECIMALS).toArray() as TXyzTuple
            this.accumulatedDistanceXYZ.subSelf(usedDistanceXYZ)
        } else if (this.mode === PlayerSpeedLoggerMode.COORD_XYZ) {
            res = this.prevPos.clone().roundSelf(LOG_COORD_DECIMALS).toArray() as TXyzTuple
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
        const strExplain = this.mode === PlayerSpeedLoggerMode.COORD_XYZ
            ? 'Coordinates'
            : `Blocks/sec`
        console.log(`Total movement: ${deltaPos}; ${length} blocks. ${strExplain} in each ${periodStr}:`, JSON.stringify(this.logEntries))
        this.logEntries.length = 0
    }
}