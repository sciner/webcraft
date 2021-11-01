export class Kb {

    constructor(canvas, options) {
        
        let that = this;

        this.canvas         = canvas;
        this.options        = options;
        this.keys_fired     = {down: {}, up: {}};

        document.onkeydown = function(e) {
            if (e.target.tagName != 'INPUT') {
                if(that._onKeyEvent(e, e.keyCode, true)) {
                    return false;
                }
            }
            if (e.ctrlKey && e.key !== '0') {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        }

        document.onkeyup = function(e) {
            if (e.target.tagName != 'INPUT') {
                if(that._onKeyEvent(e, e.keyCode, false)) {
                    return false;
                }
            }
        }

        document.onkeypress = function(e) {
            if(that.options.onKeyPress(e)) {
                return false;
            }
        }

        canvas.onmousedown  = function(e) {that.options.onMouseEvent(e, e.clientX, e.clientY, MOUSE.DOWN, e.which, e.shiftKey); e.stopPropagation(); e.preventDefault(); return false; }
        canvas.onmouseup    = function(e) {that.options.onMouseEvent(e, e.clientX, e.clientY, MOUSE.UP, e.which, e.shiftKey); e.stopPropagation(); e.preventDefault(); return false; }
        canvas.onmousemove  = function(e) {that.options.onMouseEvent(e, e.clientX, e.clientY, MOUSE.MOVE, e.which, e.shiftKey); return false; }
        canvas.onclick      = function(e) {that.options.onMouseEvent(e, e.clientX, e.clientY, MOUSE.CLICK, e.which, e.shiftKey); return false; }

    }

    // Hook for keyboard input
    _onKeyEvent(e, keyCode, down) {
        let resp = null;
        if(down) {
            if(this.keys_fired.up[keyCode]) {
                this.keys_fired.up[keyCode] = false;
            }
            let first_press = this.keys_fired.down[keyCode];
            resp = this.options.onKeyEvent(e, keyCode, down, !first_press);
            this.keys_fired.down[keyCode] = true;
        } else {
            if(this.keys_fired.down[keyCode]) {
                this.keys_fired.down[keyCode] = false;
            }
            let first_press = this.keys_fired.up[keyCode];
            resp = this.options.onKeyEvent(e, keyCode, down, !first_press);
            this.keys_fired.up[keyCode] = true;
        }
        return resp;
    }

}