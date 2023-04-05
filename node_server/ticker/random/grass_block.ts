import { BLOCK } from "@client/blocks.js";
import { Helpers, Vector } from "@client/helpers.js";
import { ServerClient } from "@client/server_client.js";
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

// tickerRandomGrassBlock
export default function randomTicker(world: ServerWorld, actions: WorldAction, world_light: int, tblock: TBlock): void {
    const over_src_block = world.getBlock(_rnd_pos_up.copyFrom(tblock.posworld).addScalarSelf(0, 1, 0), tmpTBlockOver);
    if (world_light < 4 || (over_src_block && !isLightOpacity(over_src_block))) {
        // трава зачахла
        // const p = tblock.posworld.clone().addScalarSelf(.5, 0, .5);
        // console.log('--', p.toHash().replaceAll(',', ' '), `over: ${over_src_block?.material?.name}`, world_light, isLightOpacity(over_src_block));
        actions.addBlocks([
            {pos: tblock.posworld.clone(), item: {id: BLOCK.DIRT.id}, action_id: ServerClient.BLOCK_ACTION_REPLACE}
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
                    {pos: rnd_block.posworld.clone(), item: item, action_id: ServerClient.BLOCK_ACTION_REPLACE}
                ]);
            }
        }
    }
}