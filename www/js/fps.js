// FPS
export const fps = {
    cnt:    0,
    fps:    0,
    avg:    0,
    t:      performance.now(),
    delta:  0,
    incr: function() {
        this.cnt++;
        let now = performance.now();
        if(now - this.t > 1000) {
            this.fps    = Math.round(this.cnt / ((now - this.t) / 1000));
            this.cnt    = 0;
            this.delta  = now - this.t;
            this.avg    = 1000 / Game.loopTime.avg;
            this.t      = now;
            // console.log('FPS: ' + Math.round(this.fps) + ' /' + Math.round(1000 / Game.loopTime.avg));
        };
    },
    drawHUD: function(hud) {
        //
    }
};