import {Label} from "../../ui/wm.js";

export class QuestGroup extends Label {
    [key: string]: any;

    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        const s = this.style;
        s.font.size = 12
        s.background.color = '#00000000';
        s.padding.left = 10
        s.textAlign.horizontal = 'left';
        s.textAlign.vertical = 'middle';
        s.border.hidden = true;
    }

}