globalThis.UI_ZOOM = 1

import { WindowManager } from "./wm.js"
import { InventoryWindow, RecipeWindow } from "../../js/window/index.js"

import { Lang } from "../../js/lang.js"
import { RecipeManager } from "../../js/recipes.js"
import { Qubatch } from "./qubatch.js"
import { Resources } from "../../js/resources.js"
import { initRender } from "./game.js"
import { BLOCK } from "../../js/blocks.js"
import { FileCacheStorage } from "./routines.js"
import { blobToImage } from "../../js/helpers.js"

await Lang.init({
    lang_file: '/data/lang.json'
})

await BLOCK.init({})

globalThis.randomUUID = () => crypto.randomUUID()
globalThis.Qubatch = Qubatch

const init_render_callback = async (result) => {

    const {_, inventory_image} = result

    Resources.inventory = {image: inventory_image}
    Qubatch.player.inventory.inventory_image = inventory_image

    // Define canvas and drawing context
    const canvas = document.getElementById('canvas')

    // Init Window Manager
    const wm = new WindowManager(canvas, 0, 0, canvas.width, canvas.height, true)
    wm.style.background.image = '/tools/gui/screenshot.jpg'
    wm.style.background.color = '#00000099'
    Qubatch.hud.wm = wm

    // Create inventory window
    const frmInventory = new InventoryWindow(Qubatch.player.inventory, {})

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
}

// cached image
const cacheStorage = await new FileCacheStorage('tools').open()
const inventory_image = await cacheStorage.get('/inventory.png')
const inventory_icons = await cacheStorage.get('/inventory_icons.json')

if(inventory_image) {

    // Restore
    const json = JSON.parse(await inventory_icons.text())
    for(let b of json) {
        const block = BLOCK.fromId(b.id)
        block.inventory_icon_id = b.inventory_icon_id
    }

    const result = {render: null, inventory_image: await blobToImage(await inventory_image.blob())}
    init_render_callback(result)

} else {

    await initRender(async (result) => {
        const blocks = []
        for(let b of BLOCK.getAll()) {
            blocks.push({id: b.id, inventory_icon_id: b.inventory_icon_id})
        }
        await cacheStorage.put('/inventory.png', result.inventory_image)
        await cacheStorage.put('/inventory_icons.json', JSON.stringify(blocks))
        result.inventory_image = await blobToImage(result.inventory_image)
        init_render_callback(result)
    })

}