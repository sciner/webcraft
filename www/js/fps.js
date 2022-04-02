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
        let player = Game.player;

        // Speed
        if(!this.player_pos) {
            this.player_pos = JSON.parse(JSON.stringify(Game.player.lerpPos));
            this.speed_time = performance.now();
        }

        let now = performance.now();
        const diff = now - this.t;
        const PERIOD = 1000;
        const MUL = 1000 / PERIOD;

        if(diff >= PERIOD) {
            this.fps    = Math.round(this.cnt / ((now - this.t) / PERIOD) * MUL);
            this.cnt    = 0;
            this.avg    = PERIOD / Game.averageClockTimer.avg;
            this.t      = now;
            //if(this.walkDistO > 0) {
            //    const div = (diff / 1000);
            //    this.speed = Math.round(player.lerpPos.distance(this.player_pos) / div * 360) / 100;
            //    this.player_pos = JSON.parse(JSON.stringify(Game.player.lerpPos));
            //}
            const div = diff / PERIOD;
            this.speed = Math.round(player.lerpPos.distance(this.player_pos) / div * 360 * MUL) / 100;
            this.player_pos = JSON.parse(JSON.stringify(Game.player.lerpPos));
            this.speed_time = performance.now();
            //
            this.walkDistO = player.walkDist;
            // console.log('FPS: ' + Math.round(this.fps) + ' / ' + Math.round(this.avg) + ' / ' + Math.round(Game.averageClockTimer.avg * 1000) / 1000);
        };
        this.delta  = (now - this.t);
    }

    drawHUD(hud) {
        //
    }

}