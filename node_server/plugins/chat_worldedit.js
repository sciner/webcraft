import {BLOCK} from "../../www/js/blocks.js";
import {getChunkAddr} from "../../www/js/chunk_const.js";
import {Vector, VectorCollector} from "../../www/js/helpers.js";
import {PickatActions} from "../../www/js/block_action.js";

const MAX_SET_BLOCK = 30000;

export default class WorldEdit {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {

        this.commands = new Map();
        this.commands.set('//desel', this.cmd_desel);
        this.commands.set('//pos1', this.cmd_pos1);
        this.commands.set('//pos2', this.cmd_pos2);
        this.commands.set('//copy', this.cmd_copy);
        this.commands.set('//paste', this.cmd_paste);
        this.commands.set('//set', this.cmd_set);
        this.commands.set('//walls', this.cmd_set);
        this.commands.set('//faces', this.cmd_set);
        this.commands.set('//replace', this.cmd_replace);
        this.commands.set('//xyz1', this.cmd_xyz1);
        this.commands.set('//xyz2', this.cmd_xyz2);
        // this.commands.set('//line', this.);
        // this.commands.set('//flora', this.);
        // this.commands.set('//schematic', this.);
        // this.commands.set('//clearclipboard', this.);

        // On chat command
        chat.onCmd(async (player, cmd, args) => {
            const f = this.commands.get(cmd);
            if(f) {
                if(!chat.world.admins.checkIsAdmin(player)) {
                    throw 'error_not_permitted';
                }
                await f.call(this, chat, player, cmd, args);
                return true;
            }
        });

    }

    /**
     * Reset selected region
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_desel(chat, player, cmd, args) {
        player.pos1 = null;
        player.pos2 = null;
    }

    /**
     * Set first point of selecting region
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_pos1(chat, player, cmd, args) {
        player.pos1 = player.state.pos.floored();
        let msg = `pos1 = ${player.pos1.x}, ${player.pos1.y}, ${player.pos1.z}`;
        if(player.pos2) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

    /**
     * Set second point of selecting region
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_pos2(chat, player, cmd, args) {
        player.pos2 = player.state.pos.floored();
        let msg = `pos2 = ${player.pos2.x}, ${player.pos2.y}, ${player.pos2.z}`;
        if(player.pos1) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

    /**
     * Set first point of selecting region
     * @param {*} chat 
     * @param {*} player 
     * @param {*} cmd 
     * @param {*} args 
     */
    async cmd_xyz1(chat, player, cmd, args) {
        args = chat.parseCMD(args, ['string', 'int', 'int', 'int']);
        const pos = new Vector(args[1], args[2], args[3]);
        const block = player.world.getBlock(pos);
        if(!block) {
            throw 'error_chunk_not_loaded';
        }
        player.pos1 = pos;
        let msg = `pos1 = ${player.pos1.x}, ${player.pos1.y}, ${player.pos1.z}`;
        if(player.pos2) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

    /**
     * Set second point of selecting region
     * @param {*} chat 
     * @param {*} player 
     * @param {*} cmd 
     * @param {*} args 
     */
    async cmd_xyz2(chat, player, cmd, args) {
        args = chat.parseCMD(args, ['string', 'int', 'int', 'int']);
        const pos = new Vector(args[1], args[2], args[3]);
        const block = player.world.getBlock(pos);
        if(!block) {
            throw 'error_chunk_not_loaded';
        }
        player.pos2 = pos;
        let msg = `pos2 = ${player.pos2.x}, ${player.pos2.y}, ${player.pos2.z}`;
        if(player.pos1) {
            const volume = player.pos1.volume(player.pos2);
            msg += `. Selected ${volume} blocks`;
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

    /**
     * Set block in region
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_set(chat, player, cmd, args) {
        let types = ['//set', '//walls', '//faces'];
        let quboid_fill_type_id = types.indexOf(cmd) + 1;
        const qi = this.getCuboidInfo(player);
        args = chat.parseCMD(args, ['string', 'string']);
        const palette = this.createBlocksPalette(args[1]);
        await this.fillQuboid(chat, player, qi, palette, quboid_fill_type_id);
    }

    /**
     * Copy all blocks in region to clipboard
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_copy(chat, player, cmd, args) {
        const qi = this.getCuboidInfo(player);
        let blocks = new VectorCollector();
        let chunk_addr = new Vector(0, 0, 0);
        let chunk_addr_o = new Vector(Infinity, Infinity, Infinity);
        let bpos = new Vector(0, 0, 0);
        let chunk = null;
        for(let x = 0; x < qi.volx; x++) {
            for(let y = 0; y < qi.voly; y++) {
                for(let z = 0; z < qi.volz; z++) {
                    bpos.set(
                        qi.pos1.x + x * qi.signx,
                        qi.pos1.y + y * qi.signy,
                        qi.pos1.z + z * qi.signz
                    );
                    chunk_addr = getChunkAddr(bpos, chunk_addr);
                    if(!chunk_addr_o.equal(chunk_addr)) {
                        chunk_addr_o.set(chunk_addr.x, chunk_addr.y, chunk_addr.z);
                        chunk = chat.world.chunks.get(chunk_addr);
                        if(!chunk) {
                            throw 'error_chunk_not_loaded';
                        }
                    }
                    let block = chunk.getBlock(bpos);
                    let mat = block.material;
                    if(mat.is_entity) {
                        continue;
                    }
                    if(block.id < 0) {
                        throw 'error_get_block';
                    }
                    const item = {
                        id: block.id
                    };
                    const extra_data = block.extra_data;
                    if(extra_data) {
                        item.extra_data = extra_data;
                    }
                    if(mat.can_rotate) {
                        if(block.rotate) {
                            item.rotate = block.rotate;
                        }
                    }
                    blocks.set(bpos, item);
                }
            }
        }
        player._world_edit_copy = {
            quboid: qi,
            blocks: blocks,
            player_pos: player.state.pos.floored()
        };
        let msg = `${blocks.size} block(s) copied`;
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

    /**
     * Paste copied blocks
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_paste(chat, player, cmd, args) {
        if(!player._world_edit_copy) {
            throw 'error_not_copied_blocks';
        }
        const pn_set = performance.now();
        const actions = new PickatActions(null, null, true, false);
        //
        const player_pos = player.state.pos.floored();
        let affected_count = 0;
        //
        let data = player._world_edit_copy;
        const blockIter = data.blocks.entries();
        let offset = new Vector(data.quboid.pos1).sub(data.player_pos);
        for(let [bpos, item] of blockIter) {
            let shift = bpos.sub(data.quboid.pos1);
            let new_pos = player_pos.add(shift).add(offset);
            actions.addBlocks([{pos: new_pos, item: item}]);
            affected_count++;
        }
        //
        chat.world.actions_queue.add(null, actions);
        let msg = `${affected_count} block(s) affected`;
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        console.log('Time took: ' + (performance.now() - pn_set));
    }

    /**
     * Replace blocks in region to another
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     */
    async cmd_replace(chat, player, cmd, args) {
        const qi            = this.getCuboidInfo(player);
        const repl_blocks   = this.createBlocksPalette(args[1]);
        const palette       = this.createBlocksPalette(args[2]);
        let chunk_addr      = new Vector(0, 0, 0);
        let chunk_addr_o    = new Vector(Infinity, Infinity, Infinity);
        let bpos            = new Vector(0, 0, 0);
        let chunk           = null;
        let affected_count  = 0;
        const pn_set        = performance.now();
        const actions = new PickatActions(null, null, true, false);
        for(let x = 0; x < qi.volx; x++) {
            for(let y = 0; y < qi.voly; y++) {
                for(let z = 0; z < qi.volz; z++) {
                    bpos.set(
                        qi.pos1.x + x * qi.signx,
                        qi.pos1.y + y * qi.signy,
                        qi.pos1.z + z * qi.signz
                    );
                    chunk_addr = getChunkAddr(bpos, chunk_addr);
                    if(!chunk_addr_o.equal(chunk_addr)) {
                        chunk_addr_o.set(chunk_addr.x, chunk_addr.y, chunk_addr.z);
                        chunk = chat.world.chunks.get(chunk_addr);
                        if(!chunk) {
                            throw 'error_chunk_not_loaded';
                        }
                    }
                    let block = chunk.getBlock(bpos);
                    let mat = block.material;
                    if(mat.is_entity) {
                        continue;
                    }
                    if(block.id < 0) {
                        throw 'error_error_get_block';
                    }
                    for(let b of repl_blocks.blocks) {
                        if(mat.id == b.block_id) {
                            actions.blocks.list.push({pos: bpos.clone(), item: palette.nextAsItem()});
                            affected_count++;
                            break;
                        }
                    }
                }
            }
        }
        //
        chat.world.actions_queue.add(null, actions);
        let msg = `${affected_count} block(s) affected`;
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        console.log('Time took: ' + (performance.now() - pn_set));
    }

    //
    async fillQuboid(chat, player, qi, palette, quboid_fill_type_id) {
        const pn_set = performance.now();
        const actions = new PickatActions(null, null, true, false);
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
                    actions.addBlocks([{pos: bpos, item: palette.nextAsItem()}]);
                }
            }
        }
        chat.world.actions_queue.add(null, actions);
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
        const block_extra_data_simple = new Map();
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
            let extra_data = b.extra_data;
            if(b.item || b.is_fluid || b.next_part || b.previous_part || b.style == 'extruder' || b.style == 'text') {
                throw 'error_this_block_cannot_be_setted';
            }
            if(b.is_chest) {
                extra_data = { can_destroy: true, slots: {} };
            } else if(b.tags.indexOf('sign') >= 0) {
                extra_data = {
                    text: 'Hello, World!',
                    username: 'Server',
                    dt: new Date().toISOString()
                };
            }
            if(b.can_rotate) {
                item.rotate = new Vector(0, 1, 0);
            }
            item.block_id = block_id;
            item.name = b.name;
            if(extra_data) {
                item.extra_data = extra_data;
                if(extra_data.calculated) {
                    const simple = block_extra_data_simple.get(block_id);
                    if(simple) {
                        item.extra_data = simple; // block_extra_data_simple.get(block_id);
                    } else {
                        item.extra_data = JSON.parse(JSON.stringify(extra_data));
                        delete(item.extra_data.calculated);
                        block_extra_data_simple.set(block_id, item.extra_data);
                    }
                }
            }
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
            },
            nextAsItem: function() {
                const next = this.next();
                const resp = {
                    id: next.block_id
                };
                if(next.extra_data) {
                    resp.extra_data = next.extra_data;
                }
                if(next.rotate) {
                    resp.rotate = next.rotate;
                }
                return resp;
            }
        };
    }

}