import { BLOCK } from "../../../www/js/blocks.js";
import { Helpers, Vector } from "../../../www/js/helpers.js";
import { ServerClient } from "../../../www/js/server_client.js";

const _rnd_pos = new Vector(0, 0, 0);
const _rnd_pos_up = new Vector(0, 0, 0);

//
function isLightOpacity(tblock) {
    return tblock?.material?.transparent || false || tblock.id == BLOCK.TEST.id;
}

// tickerRandomGrassBlock
export default function randomTicker(world, actions, world_light, tblock) {
    const over_src_block = world.getBlock(_rnd_pos_up.copyFrom(tblock.posworld).addScalarSelf(0, 1, 0));
    if (world_light < 4 || (over_src_block && !isLightOpacity(over_src_block))) {
        // трава зачахла
        // const p = tblock.posworld.clone().addScalarSelf(.5, 0, .5);
        // console.log('--', p.toHash().replaceAll(',', ' '), `over: ${over_src_block?.material?.name}`, world_light, isLightOpacity(over_src_block));
        actions.addBlocks([
            {pos: tblock.posworld.clone(), item: {id: BLOCK.DIRT.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY}
        ]);
    } else if (world_light >= 9) {
        // возможность распространеия 3х5х3
        _rnd_pos
            .copyFrom(tblock.posworld)
            .addScalarSelf(
                Helpers.getRandomInt(-1, 2),
                Helpers.getRandomInt(-2, 3),
                Helpers.getRandomInt(-1, 2)
            );
        const rnd_block = world.getBlock(_rnd_pos);
        if(rnd_block && rnd_block.id == BLOCK.DIRT.id) {
            const over_block = world.getBlock(_rnd_pos_up.copyFrom(rnd_block.posworld).addScalarSelf(0, 1, 0));
            if(over_block && isLightOpacity(over_block)) {
                actions.addBlocks([
                    {pos: rnd_block.posworld.clone(), item: {id: tblock.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY}
                ]);
            }
        }
    }
}