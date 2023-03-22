/**
 * Monotonic and mostly smooth UTC timer.
 * When the computer clock adjusts, this timer's value might instantly increase for up to
 * {@link MAX_PERFORMANCE_DELTA} ms, or freeze for up to {@link MAX_PERFORMANCE_DELTA} ms,
 * which is noticeable, but acceptable.
 */
export class MonotonicUTCDate {
    /**
     * Max. delta with performance.now() that doesn't cause correction to be applied.
     * It's a big value because the browser cock may be very imprecise to mitigate spectre-type attacks.
     */
    private static MAX_PERFORMANCE_DELTA = 100
    private static ADJUSTMENT_RATE = 0.01 // Gradual adjustment change relative to the clock.

    // cache it and re-calculate only if clock adjustment is detected
    private static timezoneOffsetMillis = new Date().getTimezoneOffset() * 60000 // It may change over time
    private static prevCorrectedUTCNow = Date.now() + this.timezoneOffsetMillis
    /**
     * performance.now() is monotonic and non-adjustable, so we use the difference
     * between Date.now() and performance.now() to detect clock adjustments.
     */
    private static prevPerformanceDelta = this.prevCorrectedUTCNow - performance.now()
    /** By how many milliseconds the time must be adjusted at the moment {@link correctionAtPerf} */
    private static correction = 0
    /** At which performance.now() moment {@link correction} is given */
    private static correctionAtPerf = -Infinity
    /** Used only for logging */
    private static debugLastDecreasingValue = -Infinity

    /** Similar to Date.now(), but in UTC, and the values are non-decreasing even if the computer adjusts time. */
    static now(): number {
        let UTCNow = Date.now() - this.timezoneOffsetMillis
        let performanceDelta = UTCNow - performance.now()

        // check if significant clock adjustment is detected
        if (Math.abs(performanceDelta - this.prevPerformanceDelta) > this.MAX_PERFORMANCE_DELTA) {
            // update the timezone; maybe it changed
            this.timezoneOffsetMillis = new Date().getTimezoneOffset() * 60000
            UTCNow = Date.now() - this.timezoneOffsetMillis
            performanceDelta = UTCNow - performance.now()

            // if updating the timezone didn't fix the problem
            if (Math.abs(performanceDelta - this.prevPerformanceDelta) > this.MAX_PERFORMANCE_DELTA) {
                /* Calculate a correction that removes the sudden value change (makes it gradual)
                An example:
                The clock was adjusted forward by 1 second.
                To make the change smooth, a negative correction (gradually reaching 0) must be applied.
                UTCNow suddenly increased by 1000.
                (performanceDelta = UTCNow - performance.now()) suddenly increased by 1000
                newCorrection = this.prevPerformanceDelta - performanceDelta = -1000
                */
                const newCorrection = this.prevPerformanceDelta - performanceDelta
                this.prevPerformanceDelta = performanceDelta
                // add the new correction to the remaining exiting correction
                this.correction = this.getGradualCorrection() + newCorrection
                this.correctionAtPerf = performance.now() // start counting correction from the current moment
                console.warn(`MonotonicUTCDate: new clock correction ${newCorrection}`)
            }
        }

        // apply the correction
        if (this.correction) {
            UTCNow += this.getGradualCorrection()
        }

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

    private static getGradualCorrection(): number {
        const decay = this.ADJUSTMENT_RATE * (performance.now() - this.correctionAtPerf)
        let correction = this.correction
        if (correction > 0) {
            correction = Math.round(correction - decay)
            if (correction <= 0) {
                console.log('MonotonicUTCDate: clock correction ended')
                this.correction = 0
                return 0
            }
        } else if (correction < 0) {
            correction = Math.round( correction + decay)
            if (correction >= 0) {
                console.log('MonotonicUTCDate: clock correction ended')
                this.correction = 0
                return 0
            }
        }
        return correction
    }
}