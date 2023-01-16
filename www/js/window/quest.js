import {Button, Label, Window} from "../../tools/gui/wm.js";
import { ServerClient } from "../../js/server_client.js";
import { QuestMenu } from "./quest/menu.js";
import { QuestView } from "./quest/view.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";

export class QuestWindow extends Window {

    constructor(player) {

        super(10, 10, 1700/2, 1200/2, 'frmQuests', null, null);

        this.w *= this.zoom;
        this.h *= this.zoom;

        this.player = player;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.background.image_size_mode = 'stretch';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-quest.png');
        ct.hide();

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Add labels to window
        let lbl1 = new Label(17 * this.zoom, 12 * this.zoom, 230 * this.zoom, 30 * this.zoom, 'lbl1', null, Lang.quests);
        ct.add(lbl1);

        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Qubatch.releaseMousePointer();
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
                            Qubatch.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    return true;
                }
            }
            return false;
        }

        // Quests updated
        player.world.server.AddCmdListener([ServerClient.CMD_QUEST_ALL], (cmd) => {
            for(let i = 0; i < cmd.data.length; i++) {
                const group = cmd.data[i];
                group.title = Lang.getTranslateFromJSON(group.title);
                for(let quest of group.quests) {
                    quest.title = Lang.getTranslateFromJSON(quest.title);
                    quest.description = Lang.getTranslateFromJSON(quest.description);
                    for(let action of quest.actions) {
                        action.title = Lang.getTranslateFromJSON(action.title);
                        action.description = Lang.getTranslateFromJSON(action.description);
                    }
                }
            }
            this.setData(cmd.data);
        });

        player.world.server.LoadQuests();

    }

    setData(data) {

        this.data = data;
        this.updateActive();

        if(this.groups) {
            return this.groups.update(data);
        }

        this.groups = new QuestMenu(
            16 * this.zoom,
            45 * this.zoom,
            250 * this.zoom,
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

    updateActive() {
        let quest_in_progress = null;
        let quest_new = null;
        for(let g of Qubatch.hud.wm.getWindow('frmQuests').data) {
            for(let q of g.quests) {
                // console.log(q.title, q.is_completed, q.in_progress);
                if(q.in_progress && !quest_in_progress) {
                    quest_in_progress = q;
                }
                if(!q.in_progress && !q.is_completed && !quest_new) {
                    quest_new = q;
                }
            }
        }
        this.active = quest_in_progress || quest_new;
    }

}