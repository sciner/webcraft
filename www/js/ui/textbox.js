export const BLINK_PERIOD = 500; // период моргания курсора ввода текста (мс)

export class TextBox {

    constructor(zoom) {
        this.zoom                   = zoom;
        this.active                 = false;
        this.buffer                 = [];
        this.t                      = performance.now();
        //
        this.style = {
            color: '#fff',
            padding: 5 * this.zoom,
            font: (20 * this.zoom) + ' Ubuntu',
            background_color: '#000000aa'
        };
        //
        this.resetCarriage();
    }

    draw(ctx, x, y, w, h) {
        ctx.fillStyle = this.style.background_color;
        ctx.fillRect(x, y, w, h);
        // text color
        ctx.fillStyle = this.style.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = this.style.font;
        let text = this.buffer.join('');
        let how_long_open = Math.round(performance.now() - this.t);
        let padding = this.style.padding;
        if(how_long_open % BLINK_PERIOD < BLINK_PERIOD * 0.5) {
            if(this.carriage == this.buffer.length) {
                text += '_';
            } else {
                const text_start = this.buffer.slice(0, this.carriage).join('');
                let m_start = ctx.measureText(text_start).width;
                ctx.fillText('_', x + padding + m_start, y + padding, w - padding);
            }
        }
        ctx.fillText(text, x + padding, y + padding);
    }

    // Reset carriage
    resetCarriage() {
        this.carriage = this.buffer.length;
    }

    // Move carriage
    moveCarriage(cnt) {
        this.carriage += cnt;
        this.carriage = Math.min(Math.max(this.carriage, 0), this.buffer.length);
    }
    
    typeChar(charCode, ch) {
        if(!this.active) {
            return;
        }
        if(charCode == 13) {
            return this.submit();
        }
        if(this.carriage < this.buffer.length) {
            this.buffer.splice(this.carriage, 0, ch);
        } else {
            this.buffer.push(ch);
        }
        this.moveCarriage(1);
    }

    pasteText(text) {
        if(!this.active) {
            return false;
        }
        text = text.trim();
        let chars = text.split('');
        if(chars.length > 0) {
            if(this.carriage < this.buffer.length) {
                this.buffer.splice(this.carriage, 0, ...chars);
            } else {
                this.buffer.push(...chars);
            }
            this.moveCarriage(chars.length);
        }
    }
    
    backspace() {
        if(!this.active) {
            return;
        }
        if(this.buffer.length > 0) {
            if(this.carriage == this.buffer.length) {
                this.buffer.pop();
            } else {
                this.buffer.splice(this.carriage - 1, 1);
            }
            this.moveCarriage(-1);
        }
    }

    onKeyDel() {
        if(this.carriage < this.buffer.length) {
            this.buffer.splice(this.carriage, 1);
            this.moveCarriage(0);
        }
    }

    onKeyHome() {
        this.moveCarriage(-this.buffer.length);
    }

    onKeyEnd() {
        this.moveCarriage(this.buffer.length);
    }
    
    keyPress(keyCode) {
        if(!this.active) {
            return;
        }
    }

}