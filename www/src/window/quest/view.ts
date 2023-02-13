import { Window } from "../../../tools/gui/wm.js";
import {BLOCK} from "../../../js/blocks.js";
import { Resources } from "../../resources.js";
import { Helpers } from "../../helpers.js";

// QuestActionType
export class QuestActionType {
    [key: string]: any;

    static PICKUP       = 1; // Добыть
    static CRAFT        = 2; // Скрафтить
    static SET_BLOCK    = 3; // Установить блок
    static USE_ITEM     = 4; // Использовать инструмент
    static GOTO_COORD   = 5; // Достигнуть координат

}

// QuestView
export class QuestView extends Window {
    [key: string]: any;

    //
    constructor(x, y, w, h, id, title?, text?) {

        super(x, y, w, h, id, title, text);

        // Ширина / высота слота
        this.cell_size = 36 * this.zoom;
        this.wheel_scroll = 36 * this.zoom;
        this.style.background.color = '#ffffff22';
        this.style.border.hidden = true;

        this.clip()

        // Append layout
        this.appendLayout(Resources.layout.quest_view)

        this.container = this.getWindow('questViewLayout')

    }

    _wheel(e) {
        const min_scroll = Math.min(this.h - this.container.h, 0)
        this.scrollY += Math.sign(e.original_event.wheelDeltaY) * this.wheel_scroll
        this.scrollY = Helpers.clamp(this.scrollY, min_scroll, 0)
        this.container.y = this.scrollY
    }

    show(quest) {

        const ql = this.getWindow('questViewLayout');
        const lblTitle = ql.getWindow('lblTitle');
        const lDesc = ql.getWindow('lDesc');
        const lblActions = ql.getWindow('lblActions');
        const lblRewards = ql.getWindow('lblRewards');

        //
        lblTitle.text = quest.title
        lDesc.text = quest.description

        if(quest.is_completed) {
            lblTitle.text = `✅ ${lblTitle.text}`
        }

        this.quest = quest;

        // actions
        const actions = [];
        for(let action of quest.actions) {
            let status = `🔲`
            if(action.ok) {
                status = '✅'
            }
            switch(action.quest_action_type_id) {
                case QuestActionType.CRAFT:
                case QuestActionType.SET_BLOCK:
                case QuestActionType.PICKUP: {
                    actions.push(`${status} ${action.description} ... ${action.value}/${action.cnt}`);
                    break;
                }
                /*
                case QuestActionType.USE_ITEM:
                case QuestActionType.GOTO_COORD: {
                    throw 'error_not_implemented';
                    break;
                }*/
                default: {
                    actions.push(`${status} ${action.description}`);
                    break;
                }
            }
        }
        lblActions.text = actions.join('\r\n\r\n')

        // rewards
        const rewards = []
        for(let item of quest.rewards) {
            const block = BLOCK.fromId(item.block_id);
            if(block) {
                rewards.push((rewards.length + 1) + '. ' + block.name.replaceAll('_', ' ') + ' × ' + item.cnt);
            }
        }
        lblRewards.text = rewards.join('\r\n\r\n')

        ql.visible = true;

        //
        ql.refresh();

    }

}