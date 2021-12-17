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
    }

    incr() {
        this.cnt++;
        let now = performance.now();
        let player = Game.player;
        if(now - this.t > 1000) {
            this.fps    = Math.round(this.cnt / ((now - this.t) / 1000));
            this.cnt    = 0;
            this.delta  = now - this.t;
            this.avg    = 1000 / Game.averageClockTimer.avg;
            this.t      = now;
            if(this.walkDistO > 0) {
                this.speed = Math.round(player.lerpPos.distance(player.posO) * 20 * 3.6 * 100) / 100;
            }
            this.walkDistO = player.walkDist;
            // console.log('FPS: ' + Math.round(this.fps) + ' / ' + Math.round(this.avg) + ' / ' + Math.round(Game.averageClockTimer.avg * 1000) / 1000);
        };
    }

    drawHUD(hud) {
        //
    }

}