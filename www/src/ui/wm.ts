import { Icon as icn, SimpleBlockSlot as sbs, Slider as sld, ToggleButton as tb, Label as lbl, Button as btn, TextEdit as txted, Window as wnd, GradientGraphics as gg, WindowManager as wm } from "../../tools/gui/wm.js";
import { UI_THEME } from "../constant.js";
export { MySprite, MyTilemap } from "../../tools/gui/MySpriteRenderer.js";

export class Icon extends icn {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string, zoom : number) {
        super(x, y, w, h, id, zoom)
    }

}

export class GradientGraphics extends gg {
    static [key: string]: any;
}

export class SimpleBlockSlot extends sbs {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
    }

}

export class Slider extends sld {

    constructor(x : number, y : number, w : number, h : number, id : string, value : any) {
        super(x, y, w, h, id, value)
    }

}

export class WindowManager extends wm {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string) {
        super(x, y, w, h, id)
    }

}

export class Label extends lbl {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
    }

}

export class Button extends btn {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
        this.style.border.style = 'fixed_single'
        this.style.font.color = UI_THEME.button.font.color
        this.style.border.color = UI_THEME.base_font.color
        this.style.background.color = UI_THEME.button.background.color
        this.style.font.size = UI_THEME.button.font.size
    }

    onMouseEnter() {
        super.onMouseEnter()
        this.style.background.color = '#ffffff22'
        this.style.border.color = '#ffffffff'
    }

    onMouseLeave() {
        super.onMouseLeave()
        this.style.border.color = UI_THEME.base_font.color
        this.style.background.color = UI_THEME.button.background.color
        this.style.font.color = UI_THEME.button.font.color
    }

}

export class ToggleButton extends tb {
    [key: string]: any;

    toggled_font_color = UI_THEME.button.font.color
    untoggled_font_color = UI_THEME.button.font.color

    toggled_bgcolor = UI_THEME.base_font.color
    untoggled_bgcolor = UI_THEME.button.background.color

    mouse_enter_bgcolor = '#ffffff22'
    mouse_enter_font_color = '#ffffff'

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
        this.style.border.style = 'fixed_single'
        this.style.border.color = UI_THEME.base_font.color
        this.style.background.color = UI_THEME.button.background.color
        this.style.font.color = UI_THEME.button.font.color
        this.style.font.size = UI_THEME.button.font.size
    }

}

export class TextEdit extends txted {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string, title : string, text : string) {
        super(x, y, w, h, id, title, text)
        this.style.background.color = '#00000055'
        this.style.border.style = 'fixed_single'
        this.style.border.hidden = false
        this.style.border.color = UI_THEME.base_font.color
        this.style.font.color = UI_THEME.base_font.color
    }

}

export class Window extends wnd {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
    }

}