import { Helpers } from "./helpers.js";

// FPS
export class FPSCounter {

    constructor() {
        this.cnt        = 0;
        this.fps        = 0;
        this.avg        = 0;
        this.delta      = 0;
        this.walkDistO  = 0;
        this.speed      = 0;
        this.t          = performance.now();
        this.frames     = 0;
        this.speed_time = null;
    }

    incr() {
        this.frames++;
        this.cnt++;
        let player = Qubatch.player;

        // Speed
        if(!this.player_pos) {
            this.player_pos = player.lerpPos.clone()
            this.speed_time = performance.now();
        }

        const now       = performance.now();
        const diff      = now - this.t;
        const PERIOD    = 1000;

        if(diff >= PERIOD) {
            this.fps    = Math.round(this.cnt / ((now - this.t) / PERIOD));
            this.cnt    = 0;
            this.avg    = PERIOD / Qubatch.averageClockTimer.avg;
            this.t      = now;
            this.speed = Helpers.calcSpeed(player.lerpPos, this.player_pos, diff / PERIOD);
            this.player_pos.copyFrom(player.lerpPos)
            this.speed_time = performance.now();
            //
            this.walkDistO = player.walkDist;
            // console.log('FPS: ' + Math.round(this.fps) + ' / ' + Math.round(this.avg) + ' / ' + Math.round(Qubatch.averageClockTimer.avg * 1000) / 1000);
        };
        this.delta = this.prev_now ? (now - this.prev_now) : 0;
        this.prev_now = now;
    }

    drawHUD(hud) {
        //
    }

}