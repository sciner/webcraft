globalThis.UI_ZOOM = 1

import { WindowManager } from "./wm.js"
import { InventoryWindow } from "../../js/window/index.js"
import { Lang } from "../../js/lang.js"

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
canvas.addEventListener('mouseup', wm.mouseEventDispatcher.bind(wm))
canvas.addEventListener('click', wm.mouseEventDispatcher.bind(wm))

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
        clearDragItem() {},
        exportItems() {},
        items: [
            {id: 63, count: 10}, {id: 3, count: 1}, {id: 1301, count: 2}, {id: 1420, count: 6},
            {id: 50, count: 1}, {id: 229, count: 1}, {id: 652, count: 1}, {id: 488, count: 1},
            {id: 1421, count: 1}, {id: 8, count: 10}, {id: 81, count: 8}, null, null, null, null,
            null, null, null, null, null, {id: 7, count: 1}, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
        ]
    }
}

player.inventory.player = player

// Qubatch
globalThis.Qubatch = {
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