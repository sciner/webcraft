// FPS
var fps = {
    cnt: 0,
    fps: 0,
    t: performance.now(),
    delta: 0,
    incr: function() {
        this.cnt++;
        if(performance.now() - this.t > 1000) {
            var now     = performance.now();
            this.fps    = Math.round(this.cnt / ((now - this.t) / 1000));
            this.cnt    = 0;
            this.delta  = now - this.t;
            this.t      = now;
            // console.log('FPS: ' + this.fps);
        };
    },
    drawHUD: function(hud) {
        //
    }

};