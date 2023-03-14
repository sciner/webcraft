import { Button, Label, ToggleButton, Window } from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { Vector } from "../helpers.js";
import { Lang } from "../lang.js";
import { CreativeInventoryWindow } from "./creative_inventory.js";
import { InventoryWindow } from "./inventory.js";
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

        const fromInv = new InventoryWindow(inventory, recipes)
        fromInv.autosize = false;
        // fromInv.visible = true;
        fromInv.onShow = () => {};

        const fromCreativeInv = new CreativeInventoryWindow(inventory)
        fromCreativeInv.autosize = false;
        fromCreativeInv.onShow = () => {};

        const frmStats = new StatsWindow(player)
        fromCreativeInv.autosize = false;
        frmStats.style.background.image = null
        fromCreativeInv.onShow = () => {};

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Close button
            const btnClose = new Button(this.w - this.cell_size, 12 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose')
            btnClose.style.background.image = image;
            btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onMouseDown = this.hide.bind(this)
            this.add(btnClose)
        })

        // const windows = []
        const tabs = [
            {title: 'Inventory', form: fromInv, button: null, fix_pos: new Vector(2, 0, 0)},
            {title: 'Creative', form: fromCreativeInv, button: null, fix_pos: new Vector(0, 0, 0)},
            {title: 'Stats', form: frmStats, button: null, fix_pos: new Vector(0, 0, 0)}
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
            tab.form.y += (tab.fix_pos.y * this.zoom +btn_height)
            const btnClose = tab.form.list.get('btnClose')
            if(btnClose) {
                btnClose.visible = false
            }
            // tab.form.style.background.image = null
            tab.button.form = tab.form
            this.add(tab.form)
            // windows.push(item.form)
            tab.button.onMouseDown = function(e) {
                for(let tab of tabs) {
                    const active = this.form == tab.form
                    if(active) console.log(tab.form.id)
                    tab.form.visible = active
                    tab.button.style.background.color = active ? '#7882b9' : '#ffffff55'
                }
            }
            this.add(tab.button)
        }

        tabs[0].button.onMouseDown(null)

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
        this.getRoot().center(this)
        Qubatch.releaseMousePointer()
        super.onShow(args)
    }

}