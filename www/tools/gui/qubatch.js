import { INVENTORY_DRAG_SLOT_INDEX } from "../../js/constant.js"

// Player
const player = {
    updateArmor() {},
    state: {
        skin: null
    },
    world: {
        server: {
            InventoryNewState() {}
        },
        chunkManager: {
            setLightTexFormat() {},
            postWorkerMessage() {}
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
export const Qubatch = {
    is_server: false,
    player,
    world: player.world,
    render: {
        player
    },
    hud: {
        prevDrawTime: 0
    },
    releaseMousePointer: () => {}
}
