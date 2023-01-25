import { Window } from "../../../tools/gui/wm.js";
import {BLOCK} from "../../../js/blocks.js";
import { Lang } from "../../lang.js";

// QuestActionType
export class QuestActionType {

    static PICKUP       = 1; // Добыть
    static CRAFT        = 2; // Скрафтить
    static SET_BLOCK    = 3; // Установить блок
    static USE_ITEM     = 4; // Использовать инструмент
    static GOTO_COORD   = 5; // Достигнуть координат

}

// QuestView
export class QuestView extends Window {

    //
    constructor(x, y, w, h, id, title, text) {

        super(x, y, w, h, id, title, text);
        // Ширина / высота слота
        this.cell_size = 36 * this.zoom;
        this.max_height = 0;
        this.wheel_scroll = 36 * this.zoom;
        //
        this.style.background.color = '#ffffff22';
        this.style.border.hidden = true;
        //
        this._wheel = function(e) {
            this.scrollY += Math.sign(e.original_event.wheelDeltaY) * this.wheel_scroll;
            this.scrollY = Math.min(this.scrollY, 0);
            this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.height, 0) * -1);
        };

        const FONT_ZOOM = this.zoom / 2;
        const PADDING = 20 * FONT_ZOOM;
        const TITLE_LABEL_HEIGHT = 70 * FONT_ZOOM;

        //
        this.appendLayout({
            questViewLayout: {
                type: 'VerticalLayout',
                x: 0,
                y: 0,
                width: this.w,
                visible: false,
                childs: {
                    lblTitle: {type: 'Label', x: 0, y: 0, width: 0, height: TITLE_LABEL_HEIGHT, style: {padding: PADDING, font: {size: 26 * FONT_ZOOM, family: 'Ubuntu-Bold'}}, title: 'Quest title'},
                    lDesc: {
                        type: 'Label',
                        word_wrap: true,
                        style: {
                            padding: PADDING,
                            font: {size: 26 * FONT_ZOOM},
                            background: {color: '#ffffff22'}
                        },
                        title: null,
                        text: 'Quest description'
                    },
                    l1: {
                        type: 'Label',
                        word_wrap: true,
                        style: {
                            padding: PADDING,
                            font: {size: 26 * FONT_ZOOM, family: 'Ubuntu-Bold'},
                            background: {color: '#ffffff00'}
                        },
                        title: null,
                        text: Lang.tasks + ':'
                    },
                    lblActions: {
                        type: 'Label',
                        word_wrap: true,
                        style: {
                            padding: PADDING,
                            font: {size: 26 * FONT_ZOOM},
                            background: {color: '#ffffff22'}
                        },
                        title: null,
                        text: '1. ...\r\n2. ...'
                    },
                    l2: {
                        type: 'Label',
                        word_wrap: true,
                        style: {
                            padding: PADDING,
                            font: {size: 26 * FONT_ZOOM, family: 'Ubuntu-Bold'},
                            background: {color: '#ffffff00'}
                        },
                        title: null,
                        text: Lang.rewards + ':'
                    },
                    lblRewards: {
                        type: 'Label',
                        word_wrap: true,
                        style: {
                            padding: PADDING,
                            font: {size: 26 * FONT_ZOOM},
                            background: {color: '#ffffff22'}
                        },
                        title: null,
                        text: '1. ...\r\n2. ...'
                    },
                }
            }
        });

        // this.getWindow('questViewLayout').visible = false;

    }

    show(quest) {

        // console.log(quest);

        const ql = this.getWindow('questViewLayout');
        const lblTitle = ql.getWindow('lblTitle');
        const lDesc = ql.getWindow('lDesc');
        const lblActions = ql.getWindow('lblActions');
        const lblRewards = ql.getWindow('lblRewards');
        
        //
        lblTitle.title = quest.title;
        lDesc.text = quest.description;

        if(quest.is_completed) {
            lblTitle.title = `✅ ${lblTitle.title}`; 
        }

        this.quest = quest;

        // actions
        let actions = [];
        for(let action of quest.actions) {
            let status = `🔲`; 
            if(action.ok) {
                status = '✅';
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
        lblActions.text = actions.join('\r\n\r\n');

        // rewards
        let rewards = [];
        for(let item of quest.rewards) {
            const block = BLOCK.fromId(item.block_id);
            if(block) {
                rewards.push((rewards.length + 1) + '. ' + block.name.replaceAll('_', ' ') + ' × ' + item.cnt);
            }
        }
        lblRewards.text = rewards.join('\r\n\r\n');

        ql.visible = true;

        //
        ql.refresh();
        
    }

}