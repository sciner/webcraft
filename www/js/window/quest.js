import {Button, Label, Window} from "../../tools/gui/wm.js";
import {CraftTableInventorySlot} from "./base_craft_window.js";
import { BLOCK } from "../blocks.js";
import {ServerClient} from "../../js/server_client.js";

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
        this.groups = new CreativeQuestGroups(16 * this.zoom, 45 * this.zoom, this.width - 32 * this.zoom, this.height - 45, 'wGroups');
        this.add(this.groups);
        this.groups.init(data);
    }

}

class CreativeQuestGroups extends Window {

    //
    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        // Ширина / высота слота
        this.cell_size = 36 * this.zoom;
        this.max_height = 0;
        //
        this.style.background.color = '#00000000';
        this.style.border.hidden = true;
        //
        this._wheel = function(e) {
            this.scrollY += Math.sign(e.original_event.wheelDeltaY) * this.cell_size;
            this.scrollY = Math.min(this.scrollY, 0);
            this.scrollY = Math.max(this.scrollY, Math.max(this.max_height - this.height, 0) * -1);
        };
    }

    // Init
    init(groups) {
        const ct = this;
        const GROUP_ROW_WIDTH = this.width;
        const GROUP_ROW_HEIGHT = 70;
        const GROUP_MARGIN = 10;
        let x = 0;
        let y = 0;
        // each groups
        for(let i = 0; i < groups.length; i++) {
            const group = groups[i];
            this.max_height = y + GROUP_ROW_HEIGHT;
            const lblGroup = new Button(x, y, GROUP_ROW_WIDTH, GROUP_ROW_HEIGHT, 'lblGroup' + group.id, group.title, null);
            //
            lblGroup.onMouseDown = function(e) {
                let that = this;
                return false;
            };
            ct.add(lblGroup);
            y += GROUP_ROW_HEIGHT + GROUP_MARGIN;
            // each quests
            for(let quest of group.quests) {
                console.log(quest);
                const lblQuest = new Label(x, y, GROUP_ROW_WIDTH, GROUP_ROW_HEIGHT, 'lblQuest' + quest.id, null, quest.title + '.\n' + quest.description);
                lblQuest.word_wrap = true;
                lblQuest.onMouseDown = function(e) {
                    let that = this;
                    return false;
                };
                ct.add(lblQuest);
                y += GROUP_ROW_HEIGHT + GROUP_MARGIN;
            }
        }
    }

}