import { Window } from "../../tools/gui/wm.js";
import { KEY } from "../constant.js";

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

    onShow(args) {
        this.getRoot().centerChild()
        super.onShow(args)
    }

}
