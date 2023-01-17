globalThis.UI_ZOOM = 1

import { Label, WindowManager } from "./wm.js"
import { InventoryWindow, RecipeWindow } from "../../js/window/index.js"

import { Lang } from "../../js/lang.js"
import { RecipeManager } from "../../js/recipes.js"
import { Qubatch } from "./qubatch.js"
import { Resources } from "../../js/resources.js"
import { initRender } from "./game.js"

await Lang.init({
    lang_file: '/data/lang.json'
})

globalThis.randomUUID = () => crypto.randomUUID()
globalThis.Qubatch = Qubatch

const init_render_callback = (result) => {

    const {_, inventory_image} = result

    Resources.inventory - {image: inventory_image}
    Qubatch.player.inventory.inventory_image = inventory_image

    // Define canvas and drawing context
    const canvas = document.getElementById('canvas')

    // Init Window Manager
    const wm = new WindowManager(canvas, 0, 0, canvas.width, canvas.height)
    wm.setBackground('/tools/gui/screenshot.jpg')
    wm.style.background.color = '#00000088'
    wm.swapChildren(wm.children[0], wm.children[1])

    Qubatch.hud.wm = wm

    // Все манипуляции мышью не будут работать без передачи менеджеру окон событий мыши
    canvas.addEventListener('mousemove', wm.mouseEventDispatcher.bind(wm))
    canvas.addEventListener('mousedown', wm.mouseEventDispatcher.bind(wm))
    canvas.addEventListener('mousewheel', wm.mouseEventDispatcher.bind(wm))
    canvas.addEventListener('wheel', wm.mouseEventDispatcher.bind(wm))

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
const cacheStorage = await caches.open('tools')
// return data from the cache or false
async function getCachedData(url) {
    const cachedResponse = await cacheStorage.match(url)
    if (!cachedResponse || !cachedResponse.ok) {
      return false
    }
    return cachedResponse
}
async function blobToImage(blob) {
    
    const file = new File([blob], 'image.png', {type: 'image/png'})

    const url = URL.createObjectURL(file)

    return new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
            URL.revokeObjectURL(url)
            // resolve(img)
            resolve(img)
        }
        img.src = url
    });

}
const inventory_image = await getCachedData('/inventory_image.png')
if(inventory_image) {

    // Convert the image data to a blob...
    const blob = await inventory_image.blob()
    // const bitmap = await createImageBitmap(blob, {premultiplyAlpha: 'none'})
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
        URL.revokeObjectURL(url)
        // resolve(img)
        init_render_callback({inventory_image: img, render: null})
    }
    img.src = url
} else {
    await initRender(async (result) => {
        await cacheStorage.put('/inventory_image.png', new Response(result.inventory_image))
        result.inventory_image = await blobToImage(result.inventory_image)
        init_render_callback(result)
    })
}

