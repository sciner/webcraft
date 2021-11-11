// FPS
export const fps = {
    cnt:    0,
    fps:    0,
    avg:    0,
    t:      performance.now(),
    delta:  0,
    walkDistO:    0,
    speed: 0,
    incr: function() {
        this.cnt++;
        let now = performance.now();
        let player = Game.player;
        if(now - this.t > 1000) {
            this.fps    = Math.round(this.cnt / ((now - this.t) / 1000));
            this.cnt    = 0;
            this.delta  = now - this.t;
            this.avg    = 1000 / Game.loopTime.avg;
            this.t      = now;
            if(this.walkDistO > 0) {
                this.speed = Math.round((player.walkDist - this.walkDistO) * 3600 / 1000 * 100) / 100;
            }
            this.walkDistO = player.walkDist;
            // console.log('FPS: ' + Math.round(this.fps) + ' / ' + Math.round(this.avg) + ' / ' + Math.round(Game.loopTime.avg * 1000) / 1000);
        };
    },
    drawHUD: function(hud) {
        //
    }
};