import { Window } from "../../tools/gui/wm.js";

//
export class BlankWindow extends Window {

    constructor(x, y, w, h, id, title, text) {
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
                if(!down) {
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
        return false
    }

}
