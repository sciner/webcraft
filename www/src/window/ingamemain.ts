import { Button, Label, ToggleButton, Window } from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE, KEY } from "../constant.js";
import { Vector } from "../helpers.js";
import { Lang } from "../lang.js";
import { CreativeInventoryWindow } from "./creative_inventory.js";
import { InventoryWindow } from "./inventory.js";
import { QuestWindow } from "./quest.js";
import { StatsWindow } from "./stats.js";

export class InGameMain extends Window {
    [key: string]: any;

    constructor(player, inventory, recipes) {

        super(10, 10, 860, 610, 'frmInGameMain', null, null);
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom

        this.setBackground('./media/gui/form-quest.png')

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom

        this.player = player;
        this.inventory = inventory;
        this.recipes = recipes;

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Close button
            const btnClose = new Button(this.w - this.cell_size, 12 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose')
            btnClose.style.background.image = image;
            btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onMouseDown = this.hide.bind(this)
            this.add(btnClose)
        })

        // console.log(this.inventory.player.inventory.recipes)
        // debugger
        // console.log(this.inventory.player.inventory.recipes.frmRecipe.parent())

        // const windows = []
        const tabs = this.tabs = [
            {title: Lang.inventory, form: new InventoryWindow(inventory, recipes), button: null, fix_pos: new Vector(2, 0, 0)},
            {title: Lang.creative_inventory, form: new CreativeInventoryWindow(inventory), button: null, fix_pos: new Vector(0, 0, 0)},
            {title: Lang.quests, form: new QuestWindow(player), button: null, fix_pos: new Vector(0, 0, 0)},
            {title: Lang.btn_statistics, form: new StatsWindow(player), button: null, fix_pos: new Vector(0, 0, 0)}
        ]

        let bx = 0

        // Each all tabs and make menu
        for(let i = 0; i < tabs.length; i++) {
            const tab = tabs[i]
            const btn_margin = 5 * this.zoom
            const btn_width = 150 * this.zoom
            const btn_height = 30 * this.zoom
            tab.button = new Label(17 * this.zoom + bx, 12 * this.zoom, btn_width, btn_height, `btn${i}`, tab.title, tab.title)

            tab.button.w = tab.button.getTextMetrics().width + btn_margin * 4
            bx += tab.button.w + btn_margin

            tab.button.style.textAlign.horizontal = 'center'
            tab.button.style.textAlign.vertical = 'middle'
            tab.form.x = tab.fix_pos.x * this.zoom
            tab.form.y = tab.button.y + tab.button.h //  (tab.fix_pos.y * this.zoom + btn_height + btn_margin / 2)
            tab.form.w = this.w
            tab.form.h = this.h - tab.form.y
            const btnClose = tab.form.list.get('btnClose')
            if(btnClose) {
                btnClose.visible = false
            }
            tab.form.style.background.image = null
            tab.form.autosize = false
            tab.form.ignore_esc = true
            tab.button.form = tab.form
            this.add(tab.form)
            tab.button.onMouseDown = function(e) {
                for(let tab of tabs) {
                    const active = this.form == tab.form
                    if(active) {
                        tab.form.show()
                    } else if(tab.form.visible) {
                        tab.form.hide()
                    }
                    tab.button.style.background.color = active ? '#00000011' : '#00000000'
                    tab.form.style.background.color = '#00000011'
                }
            }
            this.add(tab.button)
        }

    }

    // Обработчик открытия формы
    onShow(args) {
        this.getRoot().center(this)
        // this.getRoot().centerChild()
        Qubatch.releaseMousePointer()
        super.onShow(args)
    }

    openTab(id : string) {
        for(let i = 0; i < this.tabs.length; i++) {
            const tab = this.tabs[i]
            if(tab.form.id == id) {
                tab.button.onMouseDown(null)
                this.show()
                return
            }
        }
    }

    getTab(id : string) : Window | null {
        for(let i = 0; i < this.tabs.length; i++) {
            const tab = this.tabs[i]
            if(tab.form.id == id) {
                return tab
            }
        }
        return null
    }

    // Обработчик закрытия формы
    onHide() {
        for(let i = 0; i < this.tabs.length; i++) {
            const tab = this.tabs[i]
            if(tab.form.visible) {
                tab.form.hide()
            }
        }
        super.onHide()
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
        // return true
        // return super.onKeyEvent(e)
    }

}