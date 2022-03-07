import {Button, Label, Window, VerticalLayout} from "../../tools/gui/wm.js";
import {ServerClient} from "../../js/server_client.js";
import {BLOCK} from "../../js/blocks.js";

export class QuestWindow extends Window {

    constructor(x, y, w, h, id, title, text, player) {

        super(x, y, w, h, id, title, text);
        this.width *= this.zoom;
        this.height *= this.zoom;

        this.player = player;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.background.image_size_mode = 'stretch';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-quest.png');
        ct.hide();

        // Ширина / высота слота
        this.cell_size = 36 * this.zoom;

        // Add labels to window
        let lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 230 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Quests');
        ct.add(lbl1);

        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Game.releaseMousePointer();
        }
        
        // Обработчик закрытия формы
        this.onHide = function() {}

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            let btnClose = new Button(ct.width - this.cell_size, 12 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image = image;
            btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                ct.hide();
            }
            ct.add(btnClose);
        });

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.E:
                case KEY.ESC: {
                    if(!down) {
                        ct.hide();
                        try {
                            Game.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    return true;
                }
            }
            return false;
        }

        player.world.server.AddCmdListener([ServerClient.CMD_QUEST_ALL], (cmd) => {
            this.setData(cmd.data);
        });

        player.world.server.LoadQuests();

    }

    setData(data) {

        this.groups = new QuestMenu(
            16 * this.zoom,
            45 * this.zoom,
            250 * this.zoom,
            // (this.width - 32 * this.zoom) / 3,
            this.height - (45 + 20) * this.zoom,
            'wGroups'
        );
        this.groups.init(data);
        this.add(this.groups);

        //
        this.quest_view = new QuestView(
            (this.groups.x + this.groups.width + 16 * this.zoom),
            45 * this.zoom,
            (this.width - this.groups.width - (16 * 3) * this.zoom),
            this.height - (45 + 20) * this.zoom,
            'qView'
        );
        this.add(this.quest_view);

        //
        this.groups.setViewer(this.quest_view);

    }

}

class QuestView extends Window {

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

        //
        this.appendLayout({
            questViewLayout: {
                type: 'VerticalLayout',
                x: 0,
                y: 0,
                width: this.width,
                childs: {
                    lblTitle: {type: 'Label', x: 0, y: 0, width: 0, height: 70, style: {padding: 20}, title: 'Quest title'},
                    lDesc: {
                        type: 'Label',
                        word_wrap: true,
                        style: {
                            padding: 20,
                            font: {size: 26},
                            background: {color: '#ffffff22'}
                        },
                        title: null,
                        text: 'Quest description'
                    },
                    l1: {
                        type: 'Label',
                        word_wrap: true,
                        style: {
                            padding: 20,
                            font: {size: 26},
                            background: {color: '#ffffff00'}
                        },
                        title: null,
                        text: 'Task(s):'
                    },
                    lblActions: {
                        type: 'Label',
                        word_wrap: true,
                        style: {
                            padding: 20,
                            font: {size: 26},
                            background: {color: '#ffffff22'}
                        },
                        title: null,
                        text: '1. ...\r\n2. ...'
                    },
                    l2: {
                        type: 'Label',
                        word_wrap: true,
                        style: {
                            padding: 20,
                            font: {size: 26},
                            background: {color: '#ffffff00'}
                        },
                        title: null,
                        text: 'Reward(s):'
                    },
                    lblRewards: {
                        type: 'Label',
                        word_wrap: true,
                        style: {
                            padding: 20,
                            font: {size: 26},
                            background: {color: '#ffffff22'}
                        },
                        title: null,
                        text: '1. ...\r\n2. ...'
                    },
                }
            }
        });

        this.getWindow('questViewLayout').visible = false;

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

        // actions
        let actions = [];
        for(let item of quest.actions) {
            actions.push((actions.length + 1) + '. ' + item.description);
        }
        lblActions.text = actions.join('\r\n\r\n');

        // rewards
        let rewards = [];
        for(let item of quest.rewards) {
            const block = BLOCK.fromId(item.block_id);
            if(block) {
                rewards.push((rewards.length + 1) + '. ' + block.name.replaceAll('_', ' ') + ' x ' + item.cnt);
            }
        }
        lblRewards.text = rewards.join('\r\n\r\n');

        ql.visible = true;

        //
        ql.refresh();
        
    }

}

class ToggleButton extends Button {

    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        this.toggled = false;
        this.onMouseEnter = function() {
            this.style.background.color = '#8892c9';
            this.style.color = '#ffffff';
        }
        this.onMouseLeave = function() {
            this.style.background.color = this.toggled ? '#7882b9' : '#00000000';
            this.style.color = this.toggled ? '#ffffff' : '#3f3f3f';
        }
    }

    toggle() {
        if(this.parent.__toggledButton) {
            this.parent.__toggledButton.toggled = false;
            this.parent.__toggledButton.onMouseLeave();
            // console.log('reset toggled', this.parent.__toggledButton.id);
        }
        this.toggled = !this.toggled;
        this.parent.__toggledButton = this;
        this.style.background.color = this.toggled ? '#8892c9' : '#00000000';
        this.style.color = this.toggled ? '#ffffff' : '#3f3f3f';
    }

}

class QuestMenu extends Window {

    //
    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        // Ширина / высота слота
        this.cell_size = 36 * this.zoom;
        this.max_height = 0;
        this.wheel_scroll = 36 * this.zoom;
        //
        this.style.background.color = '#00000000';
        this.style.border.hidden = true;
        //
        this._wheel = function(e) {
            this.scrollY += Math.sign(e.original_event.wheelDeltaY) * this.wheel_scroll;
            this.scrollY = Math.min(this.scrollY, 0);
            this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.height, 0) * -1);
        };
    }

    setViewer(quest_viewer) {
        this.quest_viewer = quest_viewer;
    }

    // Init
    init(groups) {
        const ct                = this;
        const GROUP_ROW_WIDTH   = this.width;
        const GROUP_ROW_HEIGHT  = 70;
        const GROUP_MARGIN      = 20;
        let x = 0;
        let y = 0;
        // Each groups
        for(let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const lblGroup = new QuestGroup(x, y, GROUP_ROW_WIDTH, GROUP_ROW_HEIGHT, 'lblGroup' + group.id, group.title, null);
            //
            lblGroup.onMouseDown = function(e) {
                let that = this;
                return false;
            };
            ct.add(lblGroup);
            y += GROUP_ROW_HEIGHT + GROUP_MARGIN;
            // Each quests
            for(let quest of group.quests) {
                const b = new ToggleButton(x, y, this.width, 55, 'btnQuest' + quest.id, quest.title);
                b.style.font.size = 24;
                ct.add(b);
                y += b.height + GROUP_MARGIN;
                b.onMouseDown = (e) => {
                    if(b.toggled) {
                        return false;
                    }
                    this.quest_viewer.show(quest);
                    b.toggle();
                }
            }
        }
        this.calcMaxHeight();
    }

}

class QuestGroup extends Label {

    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        const s = this.style;
        s.padding.left = 10;
        s.font.size = 36;
        s.background.color = '#00000000';
        s.textAlign.horizontal = 'left';
        s.textAlign.vertical = 'middle';
        s.border.hidden = true;
    }

}