import {BLOCK} from "../../www/js/blocks.js";
import {Vector} from "../../www/js/helpers.js";

const MAX_SET_BLOCK = 30000;

export default class WorldEdit {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            switch(cmd) {
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
                case '//set':
                case '//walls':
                case '//faces': {
                    if(!chat.world.admins.checkIsAdmin(player)) {
                        throw 'error_not_permitted';
                    }
                    let types = ['//set', '//walls', '//faces'];
                    let quboid_fill_type_id = types.indexOf(cmd) + 1;
                    const qi = this.getCuboidInfo(player);
                    args = chat.parseCMD(args, ['string', 'string']);
                    const palette = this.createBlocksPalette(args[1]);
                    await this.fillQuboid(chat, player, qi, palette, quboid_fill_type_id);
                    return true;
                    break;
                }
            }
            return false;
        });
    }

    //
    async fillQuboid(chat, player, qi, palette, quboid_fill_type_id) {
        const pn_set = performance.now();
        let actions = {blocks: {
            list: [],
            options: {
                ignore_check_air: true,
                on_block_set: false
            }
        }};
        for(let x = 0; x < qi.volx; x++) {
            for(let y = 0; y < qi.voly; y++) {
                for(let z = 0; z < qi.volz; z++) {
                    switch(quboid_fill_type_id) {
                        // full
                        case 1: {
                            // do nothing
                            break;
                        }
                        // only walls
                        case 2: {
                            if((x > 0 && y >= 0 && z > 0) && (x < qi.volx - 1 && y < qi.voly && z < qi.volz - 1)) {
                                continue;
                            }
                            break;
                        }
                        // only faces
                        case 3: {
                            if((x > 0 && y > 0 && z > 0) && (x < qi.volx - 1 && y < qi.voly - 1 && z < qi.volz - 1)) {
                                continue;
                            }
                            break;
                        }
                    }
                    let bpos = new Vector(qi.pos1.x, qi.pos1.y, qi.pos1.z);
                    bpos.x += x * qi.signx;
                    bpos.y += y * qi.signy;
                    bpos.z += z * qi.signz;
                    actions.blocks.list.push({pos: bpos, item: {id: palette.next().block_id}});
                }
            }
        }
        await chat.world.applyActions(null, actions, false);
        chat.sendSystemChatMessageToSelectedPlayers(`${qi.volume} blocks changed`, [player.session.user_id]);
        console.log('Time took: ' + (performance.now() - pn_set));
    }

    // Return quboid info
    getCuboidInfo(player) {
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
        return {
            pos1: player.pos1.clone(),
            volume: volume,
            volx: Math.abs(player.pos1.x - player.pos2.x) + 1,
            voly: Math.abs(player.pos1.y - player.pos2.y) + 1,
            volz: Math.abs(player.pos1.z - player.pos2.z) + 1,
            signx: player.pos1.x > player.pos2.x ? -1 : 1,
            signy: player.pos1.y > player.pos2.y ? -1 : 1,
            signz: player.pos1.z > player.pos2.z ? -1 : 1
        };
    }

    //set 10%0,20%dirt
    //set 10%dirt,gold
    createBlocksPalette(args) {
        //
        args = new String(args);
        let blocks = args.trim().split(',');
        let blockChances = [];
        // Parse blocks pattern
        for(let a of blocks) {
            let chance = 1;
            let name = null;
            if(/[0-9]+(\\.[0-9]*)?%.*/.test(a)) {
                a = a.split('%');
                chance = parseFloat(a[0]);
                name = a[1];
            } else {
                name = a;
            }
            blockChances.push({
                chance: chance,
                name: name
            });
        }
        // Check names and validate blocks
        for(let item of blockChances) {
            let block_id = null;
            if(isNaN(item.name)) {
                let b = BLOCK.fromName(item.name.toUpperCase());
                if(b) {
                    block_id = b.id;
                }
            } else {
                block_id = parseInt(item.name);
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
            item.block_id = block_id;
            item.name = b.name;
        }
        // Random fill
        let max = 0;
        for(let block of blockChances) {
            max += block.chance;
        }
        let i = 0;
        for(let block of blockChances) {
            let v = block.chance / max;
            i += v;
            block.chance = i;
        }
        //
        return {
            blocks: blockChances,
            next: function() {
                const r = Math.random();
                for(let block of this.blocks) {
                    if (r <= block.chance) {
                        return block;
                    }
                }
                throw 'Proportional fill pattern';
            }
        };
    }

}