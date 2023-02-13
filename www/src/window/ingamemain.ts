import {Window} from "../../tools/gui/wm.js";
import { CreativeInventoryWindow } from "./creative_inventory.js";
import { InventoryWindow } from "./inventory.js";

export class InGameMain extends Window {
    [key: string]: any;

    constructor(player, inventory, recipes) {

        super(10, 10, 1700/2, 1200/2, 'frmInGameMain', null, null);

        this.w *= this.zoom;
        this.h *= this.zoom;

        this.player = player;
        this.inventory = inventory;
        this.recipes = recipes;

        const fromInv = new InventoryWindow(inventory, recipes);
        fromInv.autosize = false;
        fromInv.visible = true;
        fromInv.onShow = () => {};

        const fromCreativeInv = new CreativeInventoryWindow(inventory);
        fromCreativeInv.autosize = false;
        fromCreativeInv.onShow = () => {};

        //
        this.appendLayout({
            questViewLayout: {
                type: 'VerticalLayout',
                x: 0,
                y: 0,
                width: this.w,
                childs: {
                    btnInventory: {
                        type: 'Button',
                        title: 'Inventory',
                        height: 40 * this.zoom,
                        autosize: true,
                        onMouseDown: () => {
                            fromInv.visible = true;
                            fromCreativeInv.visible = false;
                            this.parent.refresh();
                        }
                    },
                    btnCreativeInventory: {
                        type: 'Button',
                        title: 'Creative inventory',
                        height: 40 * this.zoom,
                        autosize: true,
                        onMouseDown: () => {
                            fromInv.visible = false;
                            fromCreativeInv.visible = true;
                            this.parent.refresh();
                        }
                    },
                    fromInv,
                    fromCreativeInv
                }
            }
        });

    }

    // Обработчик открытия формы
    onShow() {
        this.getRoot().center(this)
        Qubatch.releaseMousePointer()
        super.onShow()
    }

}