import { FLUID_TYPE_MASK, FLUID_WATER_ID } from "@client/fluid/FluidConst.js";
import { Helpers, Vector } from "@client/helpers.js";
import { BLOCK_ACTION } from "@client/server_client.js";
import { TBlock } from "@client/typed_blocks3.js";
import type { WorldAction } from "@client/world_action.js";
import type { ServerWorld } from "server_world.js";

const _rnd_pos = new Vector(0, 0, 0);
const tmpTBlockRnd = new TBlock()
const _chunk_addr = new Vector()
const SWAMP_ID = 6

// tickerRandomGrassBlock
export default function randomTicker(world: ServerWorld, actions: WorldAction, world_light: int, tblock: TBlock): void {

    const grid = world.chunkManager.grid
    grid.getChunkAddr(tblock.posworld.x, tblock.posworld.y, tblock.posworld.z, _chunk_addr)
    const chunk = world.chunkManager.getChunk(_chunk_addr)
    const cell = chunk?.geCell(_rnd_pos)
    if (!cell) {
        return
    }
    if (cell.biome_id != SWAMP_ID) {
        actions.addBlocks([
            {pos: tblock.posworld.clone(), item: {id: 0}, action_id: BLOCK_ACTION.REPLACE}
        ])
        return
    }
    if (world_light >= 9) {
        _rnd_pos.copyFrom(tblock.posworld).addScalarSelf(Helpers.getRandomInt(-1, 1), Helpers.getRandomInt(-2, 2), Helpers.getRandomInt(-1, 1) )
        const above = world.getBlock(_rnd_pos, tmpTBlockRnd)
        if (above?.id == 0 && above.fluid == 0) {
            const under = world.getBlock(_rnd_pos.offset(0, -1, 0), tmpTBlockRnd)
            if (under?.id == 0 && (under.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID) {
                actions.addBlocks([
                    {pos: _rnd_pos.clone(), item: {id: tblock.id}, action_id: BLOCK_ACTION.REPLACE}
                ])
            }
        }
    }

}