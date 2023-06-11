import type { Vector } from "@client/helpers.js";
import { TBlock } from "@client/typed_blocks3.js";
import { BLOCK_ACTION } from "@client/server_client.js";
import type { ServerChunk } from "../../server_chunk.js";
import type {IBlockListener, TBlockListenerResult} from "../ticker_helpers.js";
import {BLOCK_IDS} from "@client/constant.js";
import type {TActionBlock} from "@client/world_action.js";

const CAN_SUPPORT_BUBBLES = [BLOCK_IDS.SOUL_SAND, BLOCK_IDS.BUBBLE_COLUMN]
const BUBBLES_PROPAGATION_DELAY = 800

const tmp_block = new TBlock()

export default class Bubbles implements IBlockListener {
    readonly id = "bubbles"
    readonly onChangeEnabled = { set: true, delete: true, loadBelow: true }
    readonly onNeighbourEnabled = { above: true, loadAbove: true, fluidChangeAbove: true, fluidRemoveAbove: true }

    onChange(chunk: ServerChunk, pos: Vector, block: TBlock, oldId: int, param?: any): TBlockListenerResult | null {
        const id = block.id

        // Добавить/удалить пузыри сверху после добавления/удаления этого блока
        const blockAbove = chunk.getBlock(pos.x, pos.y + 1, pos.z, tmp_block, true)
        const idAbove = blockAbove.id
        const resultAbove = idAbove >= 0
            ? this.manageBubbles(id, blockAbove, idAbove, param, true)
            : null

        // удалить пузыри в этом блоке, если их добавили, но ниже нет поддержки
        if (id === BLOCK_IDS.BUBBLE_COLUMN) {
            const blockBelow = chunk.getBlock(pos.x, pos.y - 1, pos.z, tmp_block, true)
            const idBelow = blockBelow.id
            const resultSelf = idBelow >= 0
                ? this.manageBubbles(idBelow, block, id, param, false)
                : null
            // объединить результаты для двух блоков
            if (resultSelf && resultAbove) {
                resultSelf.callAgainDelay ??= resultAbove.callAgainDelay
                resultSelf.callAgainParam ??= resultAbove.callAgainParam
                if (resultSelf.blocks && resultAbove.blocks) {
                    resultSelf.blocks = [resultSelf.blocks as TActionBlock, resultAbove.blocks as TActionBlock]
                }
            }
            return resultSelf ?? resultAbove
        }
        return resultAbove
    }

    /** Добавить/удалить пузыри сверху после изменений воды или блока над этим блоком */
    onNeighbour(chunk: ServerChunk, pos: Vector, block: TBlock, neighbour: TBlock, dir: IVector, param?: any): TBlockListenerResult | null {
        return this.manageBubbles(block.id, neighbour, neighbour.id, param, true)
    }

    protected manageBubbles(idBelow: int, block: TBlock, id: int, secondRun: int | undefined, canAdd: boolean): TBlockListenerResult | null {
        const hasBubbles = id === BLOCK_IDS.BUBBLE_COLUMN
        const shouldRemoveBubblesInstantly = !block.isWater
        const shouldHaveBubbles =
            !shouldRemoveBubblesInstantly &&
            CAN_SUPPORT_BUBBLES.includes(idBelow) &&
            (hasBubbles || id === 0)
        if (hasBubbles === shouldHaveBubbles || shouldHaveBubbles && !canAdd) {
            return null
        }
        if (!secondRun && !shouldRemoveBubblesInstantly) {
            return {
                callAgainDelay: BUBBLES_PROPAGATION_DELAY,
                callAgainParam: 1 // указывает что это - повторный запуск
            }
        }
        const blocks: TActionBlock = {
            pos: block.posworld,
            item: { id: shouldHaveBubbles ? BLOCK_IDS.BUBBLE_COLUMN : 0 },
            action_id: BLOCK_ACTION.CREATE
        }
        return { blocks }
    }
}