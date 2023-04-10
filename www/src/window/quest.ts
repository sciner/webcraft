import { Slider, ToggleButton } from "../ui/wm.js";
import { ServerClient } from "../server_client.js";
import { QuestMenu } from "./quest/menu.js";
import { QuestView } from "./quest/view.js";
import { Lang } from "../lang.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { BlankWindow } from "./blank.js";

export class QuestWindow extends BlankWindow {
    [key: string]: any

    groups : QuestMenu

    constructor(player) {

        super(0, 0, 1700/2, 1200/2, 'frmQuests', null, null)
        this.w *= this.zoom
        this.h *= this.zoom
        this.player = player

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom

        // Quests updated
        player.world.server.AddCmdListener([ServerClient.CMD_QUEST_ALL], (cmd) => {
            for(let i = 0; i < cmd.data.length; i++) {
                const group = cmd.data[i];
                group.title = Lang.getTranslateFromJSON(group.title);
                for(const quest of group.quests) {
                    quest.title = Lang.getTranslateFromJSON(quest.title);
                    quest.description = Lang.getTranslateFromJSON(quest.description)
                    for(const action of quest.actions) {
                        action.title = Lang.getTranslateFromJSON(action.title);
                        action.description = Lang.getTranslateFromJSON(action.description);
                    }
                }
            }
            this.setData(cmd.data);
        })

        player.world.server.LoadQuests()

    }

    // Обработчик открытия формы
    onShow(args) {
        // this.getRoot().center(this)
        Qubatch.releaseMousePointer()
        super.onShow(args)
    }

    // Обработчик закрытия формы
    onHide() {
        super.onHide()
    }

    setData(data) {
        
        this.data = data;
        this.updateActive();

        if(this.groups) {
            return this.groups.update(data)
        }

        const padding = 16 * this.zoom

        this.scrollbar = new Slider((this.w - 22 * this.zoom), padding, 18 * this.zoom, this.h - padding * 4, 'scroll')
        this.scrollbar.min = 0
        this.scrollbar.onScroll = (value) => {
            this.quest_view.updateScroll(-value / this.quest_view.wheel_scroll)
        }
        this.add(this.scrollbar)

        this.groups = new QuestMenu(
            padding,
            5 * this.zoom,
            250 * this.zoom,
            this.h - padding * 4,
            'wGroups'
        );
        this.groups.init(data);
        this.add(this.groups);
        //
        this.quest_view = new QuestView(
            (this.groups.x + this.groups.w + padding),
            padding,
            (this.w - this.groups.w - padding * 2.5 - this.scrollbar.w),
            this.h - padding * 4,
            'qView',
            this
        )
        this.add(this.quest_view);
        this.groups.setViewer(this.quest_view);

        // Auto show first actual quest
        let last_complete_group = null
        let first_inprogress_group = null
        for(const tb of this.groups.list.values()) {
            if(tb instanceof ToggleButton) {
                if(tb.quest.is_completed) {
                    last_complete_group = tb
                }
                if(!tb.quest.is_completed && !first_inprogress_group) {
                    first_inprogress_group = tb
                }
            }
        }
        (first_inprogress_group || last_complete_group)?.onMouseDown(null)
    }

    updateActive() {
        let quest_in_progress = null;
        let quest_new = null;
        for(const g of Qubatch.hud.wm.getWindow('frmInGameMain').getTab('frmQuests').form.data) {
            for(const q of g.quests) {
                // console.log(q.title, q.is_completed, q.in_progress);
                if(q.in_progress && !quest_in_progress) {
                    quest_in_progress = q;
                }
                if(!q.in_progress && !q.is_completed && !quest_new) {
                    quest_new = q;
                }
            }
        }
        this.active = quest_in_progress || quest_new
    }

}