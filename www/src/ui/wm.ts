import { UI_THEME } from "../constant.js";
import { Icon as icn, SimpleBlockSlot as sbs, Slider as sld,
        ToggleButton as tb, Label as lbl, Button as btn, TextEdit as txted,
        Window as wnd, GradientGraphics as gg, WindowManager as wm, VerticalLayout as vl } from "../vendors/wm/wm.js";
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

export class GradientGraphics extends gg {
    static [key: string]: any;
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
        this.style.font.color = UI_THEME.base_font.color
        this.style.font.size = UI_THEME.base_font.size
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
        this.appendLayout = appendLayout.bind(this)
    }

}