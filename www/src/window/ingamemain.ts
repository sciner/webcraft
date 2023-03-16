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

        super(10, 10, 1700/2, 1200/2, 'frmInGameMain', null, null);
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
            {title: 'Inventory', form: new InventoryWindow(inventory, recipes), button: null, fix_pos: new Vector(2, 0, 0)},
            {title: 'Creative', form: new CreativeInventoryWindow(inventory), button: null, fix_pos: new Vector(0, 0, 0)},
            {title: 'Quests', form: new QuestWindow(player), button: null, fix_pos: new Vector(0, 0, 0)},
            {title: 'Stats', form: new StatsWindow(player), button: null, fix_pos: new Vector(0, 0, 0)}
        ]

        for(let i = 0; i < tabs.length; i++) {
            const tab = tabs[i]
            const btn_margin = 5 * this.zoom
            const btn_width = 120 * this.zoom
            const btn_height = 30 * this.zoom
            tab.button = new Label(17 * this.zoom + i * (btn_width + btn_margin), 12 * this.zoom, btn_width, btn_height, `btn${i}`, tab.title, tab.title)
            tab.button.style.textAlign.horizontal = 'center'
            tab.button.style.textAlign.vertical = 'middle'
            tab.form.x = tab.fix_pos.x * this.zoom
            tab.form.y += (tab.fix_pos.y * this.zoom + btn_height + btn_margin)
            const btnClose = tab.form.list.get('btnClose')
            if(btnClose) {
                btnClose.visible = false
            }
            tab.form.style.background.image = null
            tab.form.autosize = false
            tab.form.ignore_esc = true
            // tab.form.onShow = () => {}
            tab.button.form = tab.form
            // tab.button.index = 1
            this.add(tab.form)
            // windows.push(item.form)
            tab.button.onMouseDown = function(e) {
                for(let tab of tabs) {
                    const active = this.form == tab.form
                    if(active) console.log(tab.form.id)
                    if(active) {
                        tab.form.show()
                    } else {
                        tab.form.visible = active
                    }
                    tab.button.style.background.color = active ? '#7882b9' : '#ffffff55'
                    // tab.form.style.background.color = '#00000033'
                }
            }
            this.add(tab.button)
        }

        //
        // this.appendLayout({
        //     questViewLayout: {
        //         type: 'VerticalLayout',
        //         x: 0,
        //         y: 0,
        //         width: this.w,
        //         childs: {
        //             btnInventory: {
        //                 type: 'Button',
        //                 title: 'Inventory',
        //                 height: 40 * this.zoom,
        //                 autosize: true,
        //                 onMouseDown: () => {
        //                     fromInv.visible = true;
        //                     fromCreativeInv.visible = false;
        //                     this.parent.refresh();
        //                 }
        //             },
        //             btnCreativeInventory: {
        //                 type: 'Button',
        //                 title: 'Creative inventory',
        //                 height: 40 * this.zoom,
        //                 autosize: true,
        //                 onMouseDown: () => {
        //                     fromInv.visible = false;
        //                     fromCreativeInv.visible = true;
        //                     this.parent.refresh();
        //                 }
        //             },
        //             fromInv,
        //             fromCreativeInv
        //         }
        //     }
        // });

    }

    // Обработчик открытия формы
    onShow(args) {
        // 
        this.tabs[0].button.onMouseDown(null)
        // 
        this.getRoot().center(this)
        // this.getRoot().centerChild()
        Qubatch.releaseMousePointer()
        super.onShow(args)
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