import {BLOCK} from "../../www/js/blocks.js";
import {Vector} from "../../www/js/helpers.js";

const MAX_SET_BLOCK = 30000;

export default class WorldEdit {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            switch (cmd) {
                case '//desel': {
                    player.pos1 = null;
                    player.pos2 = null;
                    return true;
                    break;
                }
                case '//pos1': {
                    if(!chat.world.admins.checkIsAdmin(player)) {
                        throw 'error_not_permitted';
                    }
                    player.pos1 = player.state.pos.floored();
                    let msg = `pos1 = ${player.pos1.x}, ${player.pos1.y}, ${player.pos1.z}`;
                    if(player.pos2) {
                        const volume = player.pos1.volume(player.pos2);
                        msg += `. Selected ${volume} blocks`;
                    }
                    chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
                    return true;
                    break;
                }
                case '//pos2': {
                    if(!chat.world.admins.checkIsAdmin(player)) {
                        throw 'error_not_permitted';
                    }
                    player.pos2 = player.state.pos.floored();
                    let msg = `pos2 = ${player.pos2.x}, ${player.pos2.y}, ${player.pos2.z}`;
                    if(player.pos1) {
                        const volume = player.pos1.volume(player.pos2);
                        msg += `. Selected ${volume} blocks`;
                    }
                    chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
                    return true;
                    break;
                }
                case '//set': {
                    const pn_set = performance.now();
                    if(!chat.world.admins.checkIsAdmin(player)) {
                        throw 'error_not_permitted';
                    }
                    args = chat.parseCMD(args, ['string', 'string']);
                    if(!player.pos1) {
                        throw 'error_pos1_not_defined';
                    }
                    if(!player.pos2) {
                        throw 'error_pos2_not_defined';
                    }
                    const volume = player.pos1.volume(player.pos2);
                    if(volume < 1) {
                        throw 'error_volume_0';
                    }
                    if(volume > MAX_SET_BLOCK) {
                        throw 'error_volume_max_' + MAX_SET_BLOCK;
                    }
                    const volx = Math.abs(player.pos1.x - player.pos2.x) + 1;
                    const voly = Math.abs(player.pos1.y - player.pos2.y) + 1;
                    const volz = Math.abs(player.pos1.z - player.pos2.z) + 1;
                    const signx = player.pos1.x > player.pos2.x ? -1 : 1;
                    const signy = player.pos1.y > player.pos2.y ? -1 : 1;
                    const signz = player.pos1.z > player.pos2.z ? -1 : 1;
                    let block_id = args[1];
                    if(isNaN(block_id) && typeof block_id === 'string') {
                        let b = BLOCK.fromName(block_id.toUpperCase());
                        if(b) {
                            block_id = b.id;
                        }
                    }
                    let b = BLOCK.fromId(block_id);
                    if(!b || b.id < 0) {
                        throw 'error_invalid_block';
                    }
                    if(b.deprecated) {
                        throw 'error_block_is_deprecated';
                    }
                    if(b.item || b.can_rotate || b.is_fluid || b.extra_data || (b.style == 'planting' && b.material.id == 'plant')) {
                        throw 'error_this_block_cannot_be_setted';
                    }
                    let actions = {blocks: {
                        list: [],
                        options: {
                            ignore_check_air: true,
                            on_block_set: false
                        }}};
                    const pos1 = player.pos1.clone();
                    for(let x = 0; x < volx; x++) {
                        for(let y = 0; y < voly; y++) {
                            for(let z = 0; z < volz; z++) {
                                let bpos = new Vector(pos1.x, pos1.y, pos1.z);
                                bpos.x += x * signx;
                                bpos.y += y * signy;
                                bpos.z += z * signz;
                                actions.blocks.list.push({pos: bpos, item: b});
                            }
                        }
                    }
                    await chat.world.applyActions(null, actions, false);
                    chat.sendSystemChatMessageToSelectedPlayers(`${volume} blocks changed`, [player.session.user_id]);
                    console.log('Time took: ' + (performance.now() - pn_set));
                    return true;
                    break;
                }
            }
            return false;
        });
    }

}