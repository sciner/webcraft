import { Label, Window } from "../../tools/gui/wm.js";

export const BLINK_PERIOD = 500; // период моргания курсора ввода текста (мс)

export class TextBox {

    /**
     * @type {Window}
     */
    chat_input

    constructor(zoom) {

        this.zoom                   = zoom
        this.active                 = false
        this.buffer                 = []
        this.t                      = performance.now()

        // styles
        this.style = {
            color: '#ffffff',
            padding: 5 * this.zoom
            // font: (20 * this.zoom) + ' Ubuntu',
        }

        this.resetCarriage()

    }

    /**
     * @param { import("../hud.js").HUD } hud
     * @returns 
     */
    init(hud) {
        
        const CHAT_INPUT_FONT = 'UbuntuMono-Regular'
        this.chat_input = new Window(0, 0, 0, 0, 'chat_input')

        // create chat text input
        this.chat_input.style.font.family = CHAT_INPUT_FONT
        this.chat_input.style.font.size = 18
        this.chat_input.style.font.color = '#ffffff'
        this.chat_input.style.background.color = '#000000aa'

        // measure line height
        this.chat_input.text = 'TW|'
        const tm = this.chat_input.getTextMetrics()
        this.line_height = tm.height + 14 * this.zoom
        hud.hudwindow.add(this.chat_input)

        // create cariage
        this.lbl_cariage = new Label(0, 0, 0, 0, 'lbl_cariage')
        this.lbl_cariage.style.font.family = CHAT_INPUT_FONT
        this.lbl_cariage.style.font.size = 18
        this.lbl_cariage.style.font.color = '#ffffff'
        this.lbl_cariage.text = '_'
        const ctm = this.lbl_cariage.getTextMetrics()
        this.space_width = ctm.width
        this.lbl_cariage.visible = false
        hud.hudwindow.add(this.lbl_cariage)

    }

    draw(x, y, width, height, margin) {

        const padding = this.style.padding

        // change position if need
        this.chat_input.transform.position.set(x, y)
        this.chat_input.w = width
        this.chat_input.h = height
        this.chat_input.style.background.color = this.chat_input.style.background.color
        this.chat_input.text_container.anchor.y = .5
        this.chat_input.text_container.position.set(margin * .5, height * .5)

        let text = this.buffer.join('')
        const how_long_open = Math.round(performance.now() - this.t);

        // blinking cariage
        let cvis = how_long_open % BLINK_PERIOD < BLINK_PERIOD * 0.5

        // chrome bug calc text measure
        if(this.prevtext != text) {
            this.chat_input.getTextMetrics(true)
            this.prevtext = text
        }

        // draw carriage
        if(cvis) {
            if(this.carriage == this.buffer.length) {
                cvis = false
                text += '_'
            } else {
                const text_start = this.buffer.slice(0, this.carriage).join('')
                this.chat_input.text = text_start
                const tm = this.chat_input.getTextMetrics(true)
                this.lbl_cariage.transform.position.set(x + padding + tm.width, y + padding + 2 * this.zoom)
            }
        }

        this.lbl_cariage.visible = cvis

        // set text
        this.chat_input.text = text

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