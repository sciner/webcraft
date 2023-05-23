import { BLOCK } from "@client/blocks.js";
import { FLUID_TYPE_MASK, FLUID_WATER_ID, PACKED_CELL_LENGTH, PACKET_CELL_BIOME_ID } from "@client/fluid/FluidConst.js";
import { Helpers, Vector } from "@client/helpers.js";
import { BLOCK_ACTION } from "@client/server_client.js";
import { TBlock } from "@client/typed_blocks3.js";
import type { WorldAction } from "@client/world_action.js";
import type { ServerWorld } from "server_world.js";

const _rnd_pos = new Vector(0, 0, 0);
const _rnd_pos_up = new Vector(0, 0, 0);
const tmpTBlockOver = new TBlock()
const tmpTBlockRnd = new TBlock()

// True если блок пропускает свет
function isLightOpacity(tblock: TBlock): boolean {
    return !!tblock?.material?.transmits_light
}

function getOverChunkBiomeId(world, blockPos) {
    let _chunk_addr = new Vector()
    let _chunk = null
    const pos = blockPos.floored();
    world.chunkManager.grid.getChunkAddr(pos.x, pos.y, pos.z, _chunk_addr);
    //console.log(_chunk_addr)
   // if (!_chunk || !_chunk.addr.equal(_chunk_addr)) {
        //_chunk = world.chunkManager.getChunk(_chunk_addr)
        //console.log(_chunk.biomes)
    //}
    if (!_chunk?.packedCells) {
        return false;
    }
    const x = pos.x - _chunk_addr.x * _chunk.size.x;
    const z = pos.z - _chunk_addr.z * _chunk.size.z;
    const cell_index = z * _chunk.size.x + x;
    const biome_id = _chunk.packedCells[cell_index * PACKED_CELL_LENGTH + PACKET_CELL_BIOME_ID]
    return biome_id
}

// tickerRandomGrassBlock
export default function randomTicker(world: ServerWorld, actions: WorldAction, world_light: int, tblock: TBlock): void {

    if (world_light >= 900) {
        _rnd_pos.copyFrom(tblock.posworld).addScalarSelf(Helpers.getRandomInt(-1, 1), Helpers.getRandomInt(-2, 2), Helpers.getRandomInt(-1, 1) )
        const above = world.getBlock(_rnd_pos, tmpTBlockRnd)
        //console.log(getOverChunkBiomeId(world, _rnd_pos))
        if (above?.id == 0 && above.fluid == 0) {
            const under = world.getBlock(_rnd_pos.offset(0, -1, 0), tmpTBlockRnd)
            if (under?.id == 0 && (under.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID) {
                const new_block_id = tblock.id
                const item = {id: new_block_id} as IBlockItem
                actions.addBlocks([
                    {pos: _rnd_pos.clone(), item: item, action_id: BLOCK_ACTION.REPLACE}
                ]);
            }
        }
    }
    
    /*const over_src_block = world.getBlock(_rnd_pos_up.copyFrom(tblock.posworld).addScalarSelf(0, 1, 0), tmpTBlockOver);
    if (world_light < 4 || (over_src_block && !isLightOpacity(over_src_block))) {
        // трава зачахла
        // const p = tblock.posworld.clone().addScalarSelf(.5, 0, .5);
        // console.log('--', p.toHash().replaceAll(',', ' '), `over: ${over_src_block?.material?.name}`, world_light, isLightOpacity(over_src_block));
        actions.addBlocks([
            {pos: tblock.posworld.clone(), item: {id: BLOCK.DIRT.id}, action_id: BLOCK_ACTION.REPLACE}
        ]);
    } else if (world_light >= 9) {
        // возможность распространеия 3х5х3
        _rnd_pos
            .copyFrom(tblock.posworld)
            .addScalarSelf(
                Helpers.getRandomInt(-1, 1),
                Helpers.getRandomInt(-2, 2),
                Helpers.getRandomInt(-1, 1)
            );
        const rnd_block = world.getBlock(_rnd_pos, tmpTBlockRnd);
        if(rnd_block && (rnd_block.id == BLOCK.DIRT.id || rnd_block.id == BLOCK.DIRT_SLAB.id)) {
            const over_block = world.getBlock(_rnd_pos_up.copyFrom(rnd_block.posworld).addScalarSelf(0, 1, 0), tmpTBlockOver);
            if(over_block && isLightOpacity(over_block)) {
                let new_block_id = tblock.id
                if(rnd_block.id == BLOCK.DIRT_SLAB.id) {
                    new_block_id = BLOCK.GRASS_BLOCK_SLAB.id
                }
                const item = {id: new_block_id} as IBlockItem
                const extra_data = rnd_block.extra_data
                if(extra_data) {
                    item.extra_data = extra_data
                }
                actions.addBlocks([
                    {pos: rnd_block.posworld.clone(), item: item, action_id: BLOCK_ACTION.REPLACE}
                ]);
            }
        }
    }*/
}