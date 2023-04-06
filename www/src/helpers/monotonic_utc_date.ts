
/**
 * If two-sided lag for a time sync packet is greater than this value, it's not accepted and a new
 * attempt is made.
 */
export const CLIENT_MAX_SYNC_TIME_TWO_SIDED_LAG = 7000

export type TApiSyncTimeRequest = {
    clientUTCDate: number // the time of request
}

export type TApiSyncTimeResponse = {
    serverUTCDate: number
    clientUTCDate: number
}

/**
 * Monotonic and mostly smooth UTC timer.
 * When the computer clock adjusts, this timer's value might instantly increase for up to
 * {@link MonotonicUTCDate.MAX_PERFORMANCE_DELTA} ms, or freeze for up to
 * {@link MonotonicUTCDate.MAX_PERFORMANCE_DELTA} ms, which is noticeable, but acceptable.
 */
export class MonotonicUTCDate {
    /**
     * Max. delta with performance.now() that doesn't cause correction to be applied.
     * It's a big value because the browser cock may be very imprecise to mitigate spectre-type attacks.
     */
    private static MAX_PERFORMANCE_DELTA = 100
    /**
     * The rate of gradual adjustment change relative to the clock.
     * 1 second per 100 seconds - seems reasonable, not noticeable to a human, and lagging hosts
     * will have enough time to react.
     */
    private static ADJUSTMENT_RATE = 0.01

    private static prevCorrectedUTCNow = -Infinity
    /**
     * performance.now() is monotonic and non-adjustable, so we use the difference
     * between Date.now() and performance.now() to detect clock adjustments.
     */
    private static prevPerformanceDelta = Date.now() - performance.now()

    /** By how many milliseconds the time must be adjusted at the moment {@link correctionMoment} */
    private static correctionValue = 0
    /** At which performance.now() moment {@link correctionValue} is given */
    private static correctionMoment = -Infinity

    /** Used only for logging */
    private static debugLastDecreasingValue = -Infinity

    /** Client-only. It's added to the local time to get the same result as on the server */
    private static externalCorrection = 0
    private static _externalCorrectionInitialized = false


    /** Similar to Date.now(), but in UTC, and the values are non-decreasing even if the computer adjusts time. */
    static now(): number {
        let UTCNow = this.nowWithoutExternalCorrection() + this.externalCorrection

        // The final check to ensure monotony. It's needed for:
        // - small negative clock adjustments that don't cause the correction to be applied
        // - possible if the correction is applied with rounding errors
        if (UTCNow < this.prevCorrectedUTCNow) {
            if (this.debugLastDecreasingValue !== this.prevCorrectedUTCNow) {
                this.debugLastDecreasingValue = this.prevCorrectedUTCNow
                console.warn(`MonotonicUTCDate: preventing decreasing time by ${UTCNow - this.prevCorrectedUTCNow}`)
            }
            return this.prevCorrectedUTCNow
        }
        return this.prevCorrectedUTCNow = UTCNow
    }

    /** Not monotonic. Only internal clock jumps are corrected. It's used to estimate the external correction. */
    static nowWithoutExternalCorrection(): number {
        const performanceNow = performance.now()
        let UTCNow = Date.now()
        let performanceDelta = UTCNow - performanceNow

        // check if significant clock adjustment is detected
        if (Math.abs(performanceDelta - this.prevPerformanceDelta) > this.MAX_PERFORMANCE_DELTA) {
            /* Calculate a correction that removes the sudden value change (makes it gradual)
            An example:
            The clock was adjusted forward by 1 second.
            To make the change smooth, a negative correction (gradually reaching 0) must be applied.
            UTCNow is suddenly increased by 1000.
            (performanceDelta = UTCNow - performance.now()) is suddenly increased by 1000
            correctionDelta = this.prevPerformanceDelta - performanceDelta = -1000
            */
            const correctionDelta = this.prevPerformanceDelta - performanceDelta
            this.addCorrection(correctionDelta, performanceNow)
            console.warn(`MonotonicUTCDate: applying correction to clock adjustment by ${Math.round(correctionDelta)} ms at ${performanceNow}`)
            this.prevPerformanceDelta = performanceDelta
        }

        // apply the correction
        if (this.correctionValue) {
            UTCNow += this.getGradualCorrection(performanceNow)
        }
        return UTCNow
    }

    static get externalCorrectionInitialized(): boolean { return this._externalCorrectionInitialized }

    /**
     * Client-only. Applies the correction to sync the clock with the server.
     * @param millis = (server's {@link now}) - (client's {@link nowWithoutExternalCorrection})
     */
    static setExternalCorrection(millis: number): void {
        millis = Math.round(millis)
        const performanceNow = performance.now()
        if (this._externalCorrectionInitialized) {
            // apply an opposite gradually diminishing correction to make the change gradual
            this.addCorrection(this.externalCorrection - millis, performanceNow)
        }
        this.externalCorrection = millis
        this._externalCorrectionInitialized = true
    }

    private static getGradualCorrection(performanceNow: number): number {
        const decay = this.ADJUSTMENT_RATE * (performanceNow - this.correctionMoment)
        let correction = this.correctionValue
        if (correction > 0) {
            correction = Math.round(correction - decay)
            if (correction <= 0) {
                console.log('MonotonicUTCDate: gradual clock correction ended')
                this.correctionValue = 0
                return 0
            }
        } else if (correction < 0) {
            correction = Math.round(correction + decay)
            if (correction >= 0) {
                console.log('MonotonicUTCDate: gradual clock correction ended')
                this.correctionValue = 0
                return 0
            }
        }
        return correction
    }
    
    private static addCorrection(millis: number, performanceNow: number): void {
        this.correctionValue = this.getGradualCorrection(performanceNow) + millis
        this.correctionMoment = performance.now() // start counting correction from the current moment
    }
}