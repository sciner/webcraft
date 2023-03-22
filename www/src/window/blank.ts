import { Button, Label, Window } from "../ui/wm.js";
import { KEY, UI_THEME } from "../constant.js";

//
export class BlankWindow extends Window {
    [key: string]: any;

    constructor(x, y, w, h, id, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
        this.visible                = false
        this.style.background.color = '#00000000'
        this.style.border.hidden    = true
    }

    // Hook for keyboard input
    onKeyEvent(e) {
        const ct = this
        const {keyCode, down, first} = e
        switch(keyCode) {
            case KEY.ESC: {
                if(!down && !this.ignore_esc) {
                    ct.hide()
                    try {
                        Qubatch.setupMousePointer(true)
                    } catch(e) {
                        console.error(e)
                    }
                }
                return true
            }
        }
        return super.onKeyEvent(e)
    }

    onShow(args) {
        super.onShow(args)
    }
    
    // Add labels to window
    addWindowTitle(title : string) {
        this.lbl1 = new Label(UI_THEME.window_padding * this.zoom, 12 * this.zoom, 200 * this.zoom, 30 * this.zoom, 'lbl1', null, title)
        this.add(this.lbl1)
        for(let lbl of [this.lbl1]) {
            lbl.style.font.color = UI_THEME.label_text_color
            lbl.style.font.size = UI_THEME.base_font.size
        }
    }

    // Add close button
    addCloseButton() {
        this.loadCloseButtonImage((image : any) => {
            // Add buttons
            const that = this
            // Close button
            const btnClose = new Button(that.w - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial'
            btnClose.style.background.image = image
            btnClose.onDrop = btnClose.onMouseDown = function(e : any) {
                that.hide()
            }
            that.add(btnClose)
        })
    }

}
