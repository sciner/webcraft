globalThis.UI_ZOOM = 1

import { WindowManager } from "./wm.js"
import { InventoryWindow, RecipeWindow } from "../../js/window/index.js"

import { BLOCK } from "../../js/blocks.js"
import { Lang } from "../../js/lang.js"
import { INVENTORY_DRAG_SLOT_INDEX } from "../../js/constant.js"
import { RecipeManager } from "../../js/recipes.js"

await BLOCK.init({
    texture_pack: 'base',
    json_url: '../../data/block_style.json',
    resource_packs_url: '../../data/resource_packs.json'
})

await Lang.init({
    lang_file: '/data/lang.json'
})

globalThis.randomUUID = () => crypto.randomUUID()

// Define canvas and drawing context
const canvas = document.getElementById('canvas')

// Init Window Manager
const wm = new WindowManager(canvas, 0, 0, canvas.width, canvas.height)
wm.setBackground('/tools/gui/screenshot.jpg')
wm.style.background.color = '#00000044'

// Все манипуляции мышью не будут работать без передачи менеджеру окон событий мыши
canvas.addEventListener('mousemove', wm.mouseEventDispatcher.bind(wm))
canvas.addEventListener('mousedown', wm.mouseEventDispatcher.bind(wm))
canvas.addEventListener('mousewheel', wm.mouseEventDispatcher.bind(wm))
canvas.addEventListener('wheel', wm.mouseEventDispatcher.bind(wm))

// Player
const player = {
    updateArmor() {},
    state: {
        skin: null
    },
    world: {
        server: {
            InventoryNewState() {}
        }
    },
    inventory: {
        items: [
            {id: 63, count: 10}, {id: 3, count: 1}, {id: 1301, count: 2}, {id: 1420, count: 6},
            {id: 50, count: 1}, {id: 229, count: 1}, {id: 652, count: 1}, {id: 488, count: 1},
            {id: 1421, count: 1}, {id: 8, count: 10}, {id: 81, count: 8}, null, null, null, null,
            null, null, null, null, null, {id: 7, count: 1}, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
        ],
        clearDragItem() {},
        exportItems() {},
        setItem(index, item) {
            this.items[index] = item
        },
        setDragItem(slot, item, drag, width, height) {
            this.items[INVENTORY_DRAG_SLOT_INDEX] = item
            if(!drag) {
                drag = wmGlobal.drag
            }
            if(item) {
                drag.setItem({
                    item,
                    /**
                     * @deprecated
                     */
                    draw(e) {
                        // slot.drawItem(e.ctx, this.item, e.x, e.y, width, height)
                    }
                })
            } else {
                this.clearDragItem()
            }
        },
        hasResources(resources, additionalItems = null) {
            return {
                missing: [],
                has: []
            }
        }
    }
}

player.inventory.player = player

// Qubatch
globalThis.Qubatch = {
    is_server: false,
    player,
    world: player.world,
    render: {
        player
    },
    hud: {
        prevDrawTime: 0,
        wm
    },
    releaseMousePointer: () => {}
}

// Create inventory window
const recipes = {}
const frmInventory = new InventoryWindow(player.inventory, recipes)

wm.add(frmInventory)
wm.add(new RecipeWindow(new RecipeManager(true)))

frmInventory.show()

wm.center(frmInventory)

// ПРИМЕРЫ
globalThis.demo = {
    // Скрыть / показать форму
    toggleVisibility: function() {
        const ct1 = wm.getWindow('frmInventory')
        ct1.toggleVisibility()
    },
    // Поменять текст надписи в указанной форме
    changeLabelText: function() {
        const ct1 = wm.getWindow('frmInventory')
        ct1.getWindow('lbl1').setText((new Date()).toLocaleString())
    }
}