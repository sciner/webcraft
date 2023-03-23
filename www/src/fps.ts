import {Helpers, Vector} from "./helpers.js";

const PERIOD    = 1000 // milliseconds

// FPS
export class FPSCounter {

    fps         = 0
    /**
     * It's just copied once per PERIOD from averageClockTimer.avg
     * It's to reduce the change frequency and make the current value easier to read.
     */
    averageClockTimerAvg = 0
    delta       = 0
    speed       = 0
    frames      = 0
    private cnt         = 0 // count in the current period
    private walkDistO   = 0 // unused
    private period_start: float
    private prev_now    : float | null  = null
    private speed_time  : float | null  = null
    private player_pos  : Vector | null = null

    // calculating worst
    private currentMaxDelta  = 0
    private prevMaxDelta     = 0

    constructor() {
        this.period_start   = performance.now();
    }

    get worstFrameFps(): int {
        const maxDelta = Math.max(this.currentMaxDelta, this.prevMaxDelta)
        return maxDelta ? Math.round(1000 / maxDelta) : 0
    }

    incr() {
        this.frames++;
        this.cnt++;
        let player = Qubatch.player;

        const now = performance.now();
        const currentPeriod = now - this.period_start;

        // Speed
        if(!this.player_pos) {
            this.player_pos = player.lerpPos.clone()
            this.speed_time = now
        }

        if(currentPeriod > PERIOD) {
            const currentPeriodSeconds = currentPeriod * 0.001
            this.fps    = Math.round(this.cnt / currentPeriodSeconds);
            this.cnt    = 0;
            this.averageClockTimerAvg = Qubatch.averageClockTimer.avg;
            this.period_start = now;
            this.speed = Helpers.calcSpeed(player.lerpPos, this.player_pos, currentPeriodSeconds);
            this.player_pos.copyFrom(player.lerpPos)
            this.speed_time = now;
            //
            this.walkDistO = player.walkDist;
            // console.log('FPS: ' + Math.round(this.fps) + ' / ' + Math.round(this.avg) + ' / ' + Math.round(Qubatch.averageClockTimer.avg * 1000) / 1000);
            this.prevMaxDelta = this.currentMaxDelta
            this.currentMaxDelta = 0
        };

        this.delta = this.prev_now ? (now - this.prev_now) : 0;
        this.prev_now = now;
        this.currentMaxDelta = Math.max(this.currentMaxDelta, this.delta)
    }

    drawHUD(hud) {
        //
    }

}