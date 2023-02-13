export class Kb {
    [key: string]: any;

    constructor(canvas, options) {

        let that            = this;
        this.canvas         = canvas;
        this.options        = options;
        this.keys_fired     = {down: {}, up: {}};
        this.keys           = {};
        this.dbl_press      = new Map();
        this.skipUntilTime  = -1;

        let makeEvent = function(e, down, first) {
            return {
                e_orig:     e,
                keyCode:    e.keyCode,
                down:       down,
                first:      first,
                shiftKey:   e.shiftKey,
                ctrlKey:    e.ctrlKey
            };
        };

        document.onkeydown = function(e) {
            if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                if (e.code !== undefined) {
                    if(e.code == 'KeyV' && e.ctrlKey)  {
                        return true;
                    }
                } else if (e.keyCode !== undefined) {
                    if(e.keyCode == KEY.V && e.ctrlKey)  {
                        return true;
                    }
                }
                if(that._onKeyEvent(makeEvent(e, true, false))) {
                    return false;
                }
            }
            if (e.ctrlKey && e.key !== '0' && e.keyCode !== KEY.C) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }

        document.onkeyup = function(e) {
            if (['INPUT', 'TEXTAREA'].indexOf(e.target.tagName) < 0) {
                if(that._onKeyEvent(makeEvent(e, false, false))) {
                    return false;
                }
            }
        }

        document.onkeypress = function(e) {
            if(that.options.onKeyPress(e)) {
                return false;
            }
        }

        canvas.onmousedown  = function(e) {e.button_id = e.which; that.options.onMouseEvent(e, e.clientX, e.clientY, MOUSE.DOWN, e.which, e.shiftKey); e.stopPropagation(); e.preventDefault(); return false; }
        canvas.onmouseup    = function(e) {e.button_id = e.which; that.options.onMouseEvent(e, e.clientX, e.clientY, MOUSE.UP, e.which, e.shiftKey); e.stopPropagation(); e.preventDefault(); return false; }
        canvas.onmousemove  = function(e) {e.button_id = e.which; that.options.onMouseEvent(e, e.clientX, e.clientY, MOUSE.MOVE, e.which, e.shiftKey); return false; }
        canvas.onclick      = function(e) {e.button_id = e.which; that.options.onMouseEvent(e, e.clientX, e.clientY, MOUSE.CLICK, e.which, e.shiftKey); return false; }

        canvas.addEventListener('wheel', function(e) {
            e.button_id = e.which
            that.options.onMouseEvent(e, e.clientX, e.clientY, MOUSE.WHEEL, e.which, e.shiftKey)
            e.preventDefault()
            return false
        }, false)

        document.addEventListener('paste', function(e) {
            // onPaste
            if (['INPUT', 'TEXTAREA'].indexOf(e.target.tagName) < 0) {
                return that.options.onPaste(e);
            }
            return true;
        });

    }

    clearStates() {
        for(let k of [KEY.W, KEY.A, KEY.S, KEY.D, KEY.SPACE, KEY.SHIFT]) {
            this.keys[k] = false;
        }
    }

    /**
     * skip next events on this duration
     * @param {number} delta
     * @returns {number}
     */
    skipUntil(delta) {
        if (delta <= 0) {
            return this.skipUntilTime = -1;
        }

        return this.skipUntilTime = performance.now() + delta;
    }

    // Hook for keyboard input
    _onKeyEvent(e) {
        if (this.skipUntilTime > -1 && performance.now() < this.skipUntilTime) {
            return false;
        }
        this.skipUntilTime = -1;

        // Detect double key press
        if(!this.dbl_press.has(e.keyCode)) {
            this.dbl_press.set(e.keyCode, {count: 0, t: -1000});
        }
        const dp = this.dbl_press.get(e.keyCode);
        if(e.down) {
            if(dp.count == 0 && performance.now() - dp.t < 250) {
                // Fire double keypress callback
                this.options.onDoubleKeyDown(e);
                dp.t = -1000;
                dp.count = 0;
            } else {
                dp.count++;
            }
        } else {
            if(dp.count == 1) {
                dp.t = performance.now();
            } else {
                dp.t = -1000;
            }
            dp.count = 0;
        }

        // Fire keypress callback
        let resp = null;
        if(e.down) {
            if(this.keys_fired.up[e.keyCode]) {
                this.keys_fired.up[e.keyCode] = false;
            }
            e.first = this.keys_fired.down[e.keyCode];
            resp = this.options.onKeyEvent(e);
            this.keys_fired.down[e.keyCode] = true;
        } else {
            if(this.keys_fired.down[e.keyCode]) {
                this.keys_fired.down[e.keyCode] = false;
            }
            e.first = this.keys_fired.up[e.keyCode];
            resp = this.options.onKeyEvent(e);
            this.keys_fired.up[e.keyCode] = true;
        }
        return resp;
    }

}