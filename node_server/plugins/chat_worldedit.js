import {BLOCK} from "../../www/js/blocks.js";
import {getChunkAddr} from "../../www/js/chunk_const.js";
import {Vector, VectorCollector} from "../../www/js/helpers.js";
import {PickatActions} from "../../www/js/block_action.js";

import {Schematic} from "prismarine-schematic";
import {promises as fs} from 'fs';

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
        this.commands.set('/schem', this.schematic);
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
        const player_pos = player.state.pos.floored();
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
                    bpos.subSelf(player_pos);
                    blocks.set(bpos, item);
                }
            }
        }
        player._world_edit_copy = {
            quboid: qi,
            blocks: blocks,
            player_pos: player_pos
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
        const data = player._world_edit_copy;
        const blockIter = data.blocks.entries();
        for(let [bpos, item] of blockIter) {
            let shift = bpos;
            let new_pos = player_pos.add(shift);
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
            if(b.item || b.next_part || b.previous_part || b.style == 'extruder' || b.style == 'text') {
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

    // schematic commands
    async schematic(chat, player, cmd, args) {
        args = chat.parseCMD(args, ['string', 'string', 'string']);
        const action = args[1];
        const blocks = new VectorCollector();
        const TEST_BLOCK = {id: BLOCK.fromName('TEST').id};
        let msg = null;
        //
        switch(action) {
            case 'save': {
                throw 'error_not_implemented';
                break;
            }
            case 'load': {
                const file_name = './plugins/schematics/' + args[2];
                const schematic = await Schematic.read(await fs.readFile(file_name))
                const not_found_blocks = new Map();
                const bpos = new Vector(0, 0, 0);
                let cnt = 0;
                // each all blocks
                await schematic.forEach((block, pos) => {
                    bpos.copyFrom(pos);
                    const name = block.name.toUpperCase();
                    const b = BLOCK[name];
                    if(b) {
                        const new_block = this.createBlockFromSchematic(block, b);
                        if(!new_block) {
                            return;
                        }
                        blocks.set(bpos, new_block);
                    } else {
                        if(!not_found_blocks.has(name)) {
                            not_found_blocks.set(name, name);
                        }
                        blocks.set(bpos, TEST_BLOCK);
                    }
                    cnt++;
                });
                // ENCHANTING_TABLE
                // ANVIL
                // BLAST_FURNACE
                // BARREL
                // CAULDRON
                // LOOM
                // LILAC
                // WHITE_WALL_BANNER
                // HOPPER
                // GRINDSTONE
                console.log('Not found blocks: ', Array.from(not_found_blocks.keys()).join('; '));
                if(cnt > 0) {
                    player._world_edit_copy = {
                        quboid: null,
                        blocks: blocks,
                        player_pos: null
                    };
                }
                msg = `... loaded (${cnt} blocks). Paste it with //paste`;
                // console.log(schematic.toJSON());
                break;
            }
            default: {
                msg = 'error_invalid_command';
                break;
            }
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

    //
    createBlockFromSchematic(block, b) {
        const props = block._properties;
        const new_block = {
            id: b.id
        };
        if(new_block.id == 0) {
            return new_block;
        }
        if(b.item || /*b.next_part || b.previous_part ||*/ b.style == 'extruder' || b.style == 'text') {
            return null;
        }
        if(b.is_chest) {
            new_block.extra_data = { can_destroy: true, slots: {} };
        } else if(b.tags.indexOf('sign') >= 0) {
            new_block.extra_data = {
                text: 'Hello, World!',
                username: 'Server',
                dt: new Date().toISOString()
            };
        }
        if(b.can_rotate) {
            new_block.rotate = new Vector(0, 1, 0);
        }
        //
        const setExtraData = (k, v) => {
            if(!new_block.extra_data) {
                new_block.extra_data = {};
            }
            new_block.extra_data[k] = v;
        };
        //
        if(props) {
            // rotate
            if(new_block.rotate && 'facing' in props) {
                const facings = ['south', 'west', 'north', 'east'];
                new_block.rotate.x = Math.max(facings.indexOf(props.facing), 0);
                if(['stairs', 'door'].indexOf(b.style) >= 0) {
                    new_block.rotate.x = (new_block.rotate.x + 2) % 4;
                }
            }
            // trapdoors and doors
            if(new_block.rotate && 'half' in props) {
                if(props.half == 'top') {
                    setExtraData('point', {x: 0, y: 0.9, z: 0});
                } else if(props.half == 'bottom') {
                    setExtraData('point', {x: 0, y: 0.1, z: 0});
                } else if(props.half == 'upper') {
                    new_block.id++;
                    setExtraData('point', {x: 0, y: 0.9, z: 0});
                }
            }
            if('open' in props) {
                setExtraData('opened', props.open);
            }
            if('hinge' in props) {
                setExtraData('left', props.hinge == 'left');
            }
            // lantern
            if('hanging' in props) {
                if(!new_block.rotate) {
                    new_block.rotate = {x: 0, y: 0.9, z: 0};
                }
                new_block.rotate.y = props.hanging ? -1 : 1;
            }
            // bed
            if(b.style == 'bed') {
                if('part' in props) {
                    const is_head = props.part == 'head';
                    setExtraData('is_head', is_head);
                    if(!is_head && 'rotate' in new_block) {
                        new_block.rotate.x = (new_block.rotate.x + 2) % 4;
                    }
                }
            }
            // part: 'head', occupied: false, facing: 'north' }
            // _properties: { part: 'foot
            // slabs
            if(b.layering && b.layering.slab && 'type' in props) {
                if(props.type == 'top') {
                    setExtraData('point', {x: 0, y: 0.9, z: 0});
                } else if(props.type == 'bottom') {
                    setExtraData('point', {x: 0, y: 0.1, z: 0});
                }
            }
        }
        //
        // _properties: { part: 'head', occupied: false, facing: 'north' }
        // _properties: { part: 'foot', occupied: false, facing: 'north' }
        //
        // door {hinge: left|right, open: true|false}
        //  _properties: {
        //    waterlogged: false,
        //    powered: false,
        //    open: false,
        //    half: 'top',
        //    facing: 'west'
        //  }
        // CHEST
        //     ._properties: { waterlogged: false, type: 'right', facing: 'north' }
        //     .metadata = 3; 5
        //
        // OAK_STAIRS
        // _properties: {
        //        waterlogged: false,
        //        shape: 'straight',
        //        half: 'top',
        //        facing: 'north'
        //    }
        if(b.name == 'RED_BED') {
            console.log(block);
        }
        return new_block;
    }

}