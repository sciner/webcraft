import { UI_THEME } from "../constant.js";
import { Icon as icn, SimpleBlockSlot as sbs, Slider as sld,
        ToggleButton as tb, Label as lbl, CheckBox as chk, Button as btn, TextEdit as txted,
        HTMLText as htmlt,
        Window as wnd, WindowManager as wm, VerticalLayout as vl } from "../vendors/wm/wm.js";
export { MySprite, MyTilemap } from "../vendors/wm/MySpriteRenderer.js";

/**
 * @param {object} layout 
 */
function appendLayout(layout) {
    layout = JSON.parse(JSON.stringify(layout))
    const ignored_props = [
        'x', 'y', 'width', 'height', 'childs', 'style', 'type'
    ]
    const zoom = UI_ZOOM  * Qubatch.settings.window_size / 100
    const calcLayoutSize = (value, def_value) => {
        if(value === undefined) {
            return def_value
        }
        return (value | 0) * zoom
    }
    for(let id in layout) {
        const cl = layout[id]
        let control = null
        if(cl instanceof Window) {
            control = cl
        } else {
            const x = calcLayoutSize(cl.x, 0)
            const y = calcLayoutSize(cl.y, 0)
            const w = calcLayoutSize(cl.width, this.w)
            const h = calcLayoutSize(cl.height, 0)
            if (cl?.style?.padding) {
                cl.style.padding *= zoom
            }
            if (cl?.gap) {
                cl.gap *= zoom
            }
            switch(cl.type) {
                case 'VerticalLayout': {
                    control = new VerticalLayout(x, y, w, id);
                    if(cl.childs) {
                        control.appendLayout(cl.childs)
                    }
                    break
                }
                case 'Label': {
                    control = new Label(x, y, w, h, id, cl?.title, cl?.text)
                    break
                }
                case 'Button': {
                    control = new Button(x, y, w, h, id, cl?.title, cl?.text)
                    break
                }
                case 'Slider': {
                    control = new Slider(x, y, h, w, id)
                    break
                }
            }
        }
        if(control) {
            if(cl.style) {
                control.assignStyles(cl.style)
            }
            // set other props
            for(let prop in cl) {
                if(ignored_props.indexOf(prop) < 0) {
                    control[prop] = cl[prop]
                }
            }
            this.add(control)
            if('refresh' in control) {
                control.refresh()
            }
        }
    }
}

export class Icon extends icn {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string, zoom : number) {
        super(x, y, w, h, id, zoom)
    }

}
export class SimpleBlockSlot extends sbs {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
    }

}

export class VerticalLayout extends vl {
    [key: string]: any;

    constructor(x : number, y : number, w : number, id : string) {
        super(x, y, w, id)
        this.appendLayout = appendLayout.bind(this)
    }

}

export class Slider extends sld {

    constructor(x : number, y : number, w : number, h : number, id : string) {
        super(x, y, w, h, id)
        this.style.border.hidden = true
        this.style.background.color = '#00000000'
        const thumb = this.wScrollThumb
        thumb.style.background.color = UI_THEME.button.background.color
        thumb.style.border.hidden = false
        thumb.style.border.style = 'fixed_single'
        thumb.style.border.color = UI_THEME.base_font.color
    }
    
}

export class WindowManager extends wm {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string) {
        super(x, y, w, h, id)
    }

    /** Redirects the drop event to a visible window that can process drop events outside its borders. */
    onDrop(e?) {
        if (e) {
            for(const window of this.visibleWindows()) {
                if (window.onDropOutside && window.onDropOutside(e)) {
                    break
                }
            }
        }
    }
}

export class Label extends lbl {
    [key: string]: any;

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
        this.style.font.color = UI_THEME.base_font.color
        this.style.font.size = UI_THEME.base_font.size
    }

}

export class CheckBox extends chk {

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
        this.style.border.color = UI_THEME.button.border.disabled_color
        this.style.border.style = 'fixed_single'
        this.style.border.hidden = false

    }

}

export class Button extends btn {

    private _enabled = true

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
        this.style.border.style = 'fixed_single'
        this.style.font.size = UI_THEME.button.font.size
        this.setDefaultColors()
    }

    get enabled(): boolean { return this._enabled }

    set enabled(v: boolean) {
        this._enabled = v
        if (this.style) { // когда оно вызывается из конструктора окна (где похоже не обязательно вызывать), this.style еще не определено
            if (v) {
                this.setDefaultColors()
            } else {
                this.style.border.color = UI_THEME.button.border.disabled_color
                this.style.background.color = UI_THEME.button.background.disabled_color
                this.style.font.color = UI_THEME.button.font.disabled_color
            }
        }
    }

    onMouseEnter() {
        if (this._enabled) {
            super.onMouseEnter()
            this.style.background.color = '#ffffff22'
            this.style.border.color = '#ffffffff'
        }
    }

    onMouseLeave() {
        if (this._enabled) {
            super.onMouseLeave()
            this.setDefaultColors()
        }
    }

    /** Устанавливает цвета кнопки в обычном состоянии (не выделенной, не отключенной) */
    protected setDefaultColors(): void {
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
        this.appendLayout = appendLayout.bind(this)
    }

}

export class HTMLText extends htmlt {

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
    }

}