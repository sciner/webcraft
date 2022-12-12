import {BLOCK} from "../../www/js/blocks.js";
import { getChunkAddr, Vector, VectorCollector } from "../../www/js/helpers.js";
import {WorldAction} from "../../www/js/world_action.js";
import { SchematicReader } from "./worldedit/schematic_reader.js";
import { ServerClient } from "../../www/js/server_client.js";
import { FLUID_LAVA_ID, FLUID_TYPE_MASK, FLUID_WATER_ID } from "../../www/js/fluid/FluidConst.js";
import { WorldEditBuilding } from "./worldedit/building.js";
import { BuilgingTemplate } from "../../www/js/terrain_generator/cluster/building_template.js";

const MAX_SET_BLOCK         = 250000;
const MAX_BLOCKS_PER_PASTE  = 10000;

export default class WorldEdit {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {

        this.building = new WorldEditBuilding(this);

        //
        this.commands = new Map();
        this.commands.set('/desel', this.cmd_desel);
        this.commands.set('/pos1', this.cmd_pos1);
        this.commands.set('/pos2', this.cmd_pos2);
        this.commands.set('/xyz1', this.cmd_xyz1);
        this.commands.set('/xyz2', this.cmd_xyz2);
        this.commands.set('/copy', this.cmd_copy);
        this.commands.set('/paste', this.cmd_paste);
        this.commands.set('/set', this.cmd_set);
        this.commands.set('/walls', this.cmd_set);
        this.commands.set('/faces', this.cmd_set);
        this.commands.set('/replace', this.cmd_replace);
        this.commands.set('/schem', this.cmd_schematic);
        this.commands.set('/schematic', this.cmd_schematic);
        this.commands.set('/clearclipboard', this.cmd_clearclipboard);
        this.commands.set('/building', this.cmd_building);
        this.commands.set('/rotate', this.cmd_rotate)
        // this.commands.set('//line', this.);
        // this.commands.set('//flora', this.);
        // this.commands.set('//undo', this.);

        // On chat command
        chat.onCmd(async (player, cmd, args) => {
            while(cmd.indexOf('//') === 0) {
                cmd = cmd.substring(1)
            }
            const f = this.commands.get(cmd);
            if(f) {
                if(!chat.world.admins.checkIsAdmin(player)) {
                    throw 'error_not_permitted';
                }
                try {
                    await f.call(this, chat, player, cmd, args);
                } catch(e) {
                    console.log(e);
                    throw e;
                }
                return true;
            }
        });

    }

    // Clear clipboard
    async cmd_clearclipboard(chat, player, cmd, args) {
        delete(player._world_edit_copy);
        chat.sendSystemChatMessageToSelectedPlayers('clipboard_cleared', [player.session.user_id]);
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
        //
        let actions = new WorldAction(null, null, true, false/*, false*/);
        actions.addBlocks([{pos: player.pos1, item: {id: BLOCK.NUM1.id}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        chat.world.actions_queue.add(null, actions);
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
        //
        let actions = new WorldAction(null, null, true, false/*, false*/);
        actions.addBlocks([{pos: player.pos2, item: {id: BLOCK.NUM2.id}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        chat.world.actions_queue.add(null, actions);
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
        const types = ['/set', '/walls', '/faces'];
        const quboid_fill_type_id = types.indexOf(cmd) + 1;
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
        const player_pos = player.state.pos.floored();
        player._world_edit_copy = await this.copy(qi, player_pos, chat.world);
        const msg = `${player._world_edit_copy.blocks.size} block(s) copied`;
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

    /**
     * @param {*} qi 
     * @param {Vector} pos
     */
    async copy(qi, pos, world) {
        let blocks = new VectorCollector();
        let chunk_addr = new Vector(0, 0, 0);
        let chunk_addr_o = new Vector(Infinity, Infinity, Infinity);
        let bpos = new Vector(0, 0, 0);
        let chunk = null;
        const fluids = [];
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
                        chunk = world.chunks.get(chunk_addr);
                        if(!chunk) {
                            throw 'error_chunk_not_loaded';
                        }
                    }
                    let block = chunk.getBlock(bpos);
                    let mat = block.material;
                    //if(mat.is_entity) {
                    //    continue;
                    //}
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
                    bpos.subSelf(pos);
                    if (block.fluid != 0) {
                        fluids.push(bpos.x);
                        fluids.push(bpos.y);
                        fluids.push(bpos.z);
                        fluids.push(block.fluid);
                    }
                    blocks.set(bpos, item);
                }
            }
        }
        return {
            quboid: qi,
            blocks: blocks,
            player_pos: pos.clone(),
            fluids: fluids
        };
    }

    //
    async cmd_building(chat, player, cmd, args) {
        if(!chat.world.admins.checkIsAdmin(player)) {
            throw 'error_not_permitted';
        }
        args = chat.parseCMD(args, ['string', 'string', 'string']);
        await this.building.onCmd(chat, player, cmd, args);
    }

    //
    async cmd_rotate(chat, player, cmd, args, copy_data) {

        if(!player._world_edit_copy && !copy_data) {
            throw 'error_not_copied_blocks';
        }

        args = chat.parseCMD(args, ['string', 'int']);

        // Detect direction
        const dirs = {
            270: 1,
            180: 2,
            90: 3
        }
        let angle = args[1];
        const dir = dirs[angle]
        if(!dir) {
            throw 'error_no_interpolation';
        }

        //
        const data = copy_data ?? player._world_edit_copy;
        const new_blocks = new VectorCollector();

        for(let [bpos, item] of data.blocks.entries()) {
            const pos = new Vector(0, 0, 0).addByCardinalDirectionSelf(bpos, dir, false, false);
            item.block_id = item.id;
            item.pos = pos
            new_blocks.set(pos, item);
        }

        const rot = [[], [], [], []];

        // rotate blocks property
        BuilgingTemplate.rotateBlocksProperty(new_blocks, rot, chat.world.block_manager, [dir])

        for(let i = 0; i < rot[dir].length; i++) {
            const item = rot[dir][i]
            const pos = item.pos
            delete(item.pos)
            delete(item.block_id)
            new_blocks.set(pos, item)
        }

        data.blocks = new_blocks;

        const msg = `${data.blocks.size} block(s) rotated`;
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);

    }

    /**
     * Paste copied blocks
     * @param {*} chat
     * @param {*} player
     * @param {*} cmd
     * @param {*} args
     * @param {*} copy_data
     */
    async cmd_paste(chat, player, cmd, args, copy_data = null) {
        if(!player._world_edit_copy && !copy_data) {
            throw 'error_not_copied_blocks';
        }
        const pn_set = performance.now();
        //
        const actions_list = new VectorCollector();
        const createwWorldActions = () => {
            const resp = new WorldAction(null, null, true, false);
            return resp;
        };
        //
        const player_pos = player.state.pos.floored();
        let affected_count = 0;
        //
        const data = copy_data ?? player._world_edit_copy;
        const blockIter = data.blocks.entries();
        let chunk_addr = null;
        let chunk_addr_o = new Vector(Infinity, Infinity, Infinity);
        const action_id = ServerClient.BLOCK_ACTION_CREATE;
        let actions = null;
        for(let [bpos, item] of blockIter) {
            const shift = bpos;
            const pos = player_pos.add(shift);
            chunk_addr = getChunkAddr(pos, chunk_addr);
            if(!chunk_addr_o.equal(chunk_addr)) {
                chunk_addr_o.copyFrom(chunk_addr);
                actions = actions_list.get(chunk_addr);
                if(!actions) {
                    actions = createwWorldActions();
                    actions_list.set(chunk_addr, actions);
                }
            }
            actions.addBlocks([{pos, item, action_id}]);
            affected_count++;
        }
        if (data.fluids && data.fluids.length > 0) {
            const fluids = data.fluids;
            for (let i = 0; i < fluids.length; i += 4) {
                let x = fluids[i] + player_pos.x, y = fluids[i + 1] + player_pos.y, z = fluids[i + 2] + player_pos.z, val = fluids[i + 3];
                chunk_addr = getChunkAddr(x, y, z, chunk_addr);
                if(!chunk_addr_o.equal(chunk_addr)) {
                    chunk_addr_o.copyFrom(chunk_addr);
                    actions = actions_list.get(chunk_addr);
                    if(!actions) {
                        actions = createwWorldActions();
                        actions_list.set(chunk_addr, actions);
                    }
                }
                actions.addFluids([x, y, z, val]);
                actions.fluidFlush = true;
            }
            affected_count++;
        }
        let cnt = 0;
        const notify = {
            user_id: player.session.user_id,
            total_actions_count: actions_list.size,
            message: 'WorldEdit paste completed!'
        };
        for(const [_, actions] of actions_list.entries()) {
            if(player) {
                if(cnt == 0 || cnt == actions_list.size - 1) {
                    actions.notify = notify;
                }
                cnt++
            }
            chat.world.actions_queue.add(null, actions);
        }
        const affected_count_formatted = affected_count.toLocaleString('us');
        const msg = `${affected_count_formatted} block(s) affected`;
        const pn = Math.round((performance.now() - pn_set) * 10) / 10;
        const blocks_per_sec = Math.round(affected_count / (pn / 1000));
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
        console.log(`world_edit: ${msg}`);
        console.log(`world_edit: cmd_paste time: ${pn} ms, chunks: ${actions_list.size}; blocks_per_sec: ${blocks_per_sec}`);
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
        const actions = new WorldAction(null, null, true, false);
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
                    for(let rb of repl_blocks.blocks) {
                        let replace = false;
                        // TODO: make this automatic (#water)
                        if(rb.is_fluid) {
                            const fluidValue = block.fluid;
                            if(mat.id == 0 && fluidValue > 0) {
                                if((fluidValue & FLUID_TYPE_MASK) == FLUID_WATER_ID) {
                                    replace = true;
                                } else if((fluidValue & FLUID_TYPE_MASK) == FLUID_LAVA_ID) {
                                    replace = true;
                                }
                            }
                        } else {
                            replace = mat.id == rb.block_id;
                        }
                        if(replace) {
                            actions.addBlocks([
                                {
                                    pos: bpos.clone(), 
                                    item: palette.nextAsItem(), 
                                    action_id: ServerClient.BLOCK_ACTION_CREATE
                                }
                            ]);
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
        console.log('world_edit.replace time took: ' + (performance.now() - pn_set));
    }

    //
    checkQuboidAffectedBlocksLimit(qi, quboid_fill_type_id) {
        let total_count = qi.volume;
        const size = new Vector(qi.volx, qi.voly, qi.volz);
        const WALL_WIDTH = 1;
        switch(quboid_fill_type_id) {
            // full
            case 1: {
                // do nothing
                break;
            }
            // only walls
            case 2: {
                size.x -= WALL_WIDTH * 2;
                size.z -= WALL_WIDTH * 2;
                if(size.x > 0 && size.y > 0 && size.z > 0) {
                    total_count -= (size.x * size.y * size.z);
                }
                break;
            }
            // only faces
            case 3: {
                size.x -= WALL_WIDTH * 2;
                size.y -= WALL_WIDTH * 2;
                size.z -= WALL_WIDTH * 2;
                if(size.x > 0 && size.y > 0 && size.z > 0) {
                    total_count -= (size.x * size.y * size.z);
                }
                break;
            }
        }
        if(total_count > MAX_SET_BLOCK) {
            throw 'error_volume_max_' + MAX_SET_BLOCK;
        }
    }

    //
    async fillQuboid(chat, player, qi, palette, quboid_fill_type_id) {
        const pn_set = performance.now();
        let actions = new WorldAction(null, null, true, false);
        let affected_count = 0;
        this.checkQuboidAffectedBlocksLimit(qi, quboid_fill_type_id);
        //
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
                    affected_count++;
                    const bpos = new Vector(qi.pos1.x, qi.pos1.y, qi.pos1.z);
                    bpos.x += x * qi.signx;
                    bpos.y += y * qi.signy;
                    bpos.z += z * qi.signz;
                    if(affected_count % MAX_BLOCKS_PER_PASTE == 0) {
                        chat.world.actions_queue.add(null, actions);
                        actions = new WorldAction(null, null, true, false);
                    }
                    actions.addBlocks([{pos: bpos, item: palette.nextAsItem(), action_id: ServerClient.BLOCK_ACTION_CREATE}]);
                }
            }
        }
        chat.world.actions_queue.add(null, actions);
        chat.sendSystemChatMessageToSelectedPlayers(`${affected_count} blocks changed`, [player.session.user_id]);
        console.log('world_edit.fill_quboid time took: ' + (performance.now() - pn_set));
    }

    // Return quboid info
    getCuboidInfo(obj) {
        if(!obj.pos1) {
            throw 'error_pos1_not_defined';
        }
        if(!obj.pos2) {
            throw 'error_pos2_not_defined';
        }
        const volume = obj.pos1.volume(obj.pos2);
        if(volume < 1) {
            throw 'error_volume_0';
        }
        return {
            pos1: obj.pos1.clone(),
            volume: volume,
            volx: Math.abs(obj.pos1.x - obj.pos2.x) + 1,
            voly: Math.abs(obj.pos1.y - obj.pos2.y) + 1,
            volz: Math.abs(obj.pos1.z - obj.pos2.z) + 1,
            signx: obj.pos1.x > obj.pos2.x ? -1 : 1,
            signy: obj.pos1.y > obj.pos2.y ? -1 : 1,
            signz: obj.pos1.z > obj.pos2.z ? -1 : 1
        };
    }

    //set 10%0,20%dirt
    //set 10%dirt,gold_block
    createBlocksPalette(args) {
        args = new String(args);
        const blocks = args.trim().split(',');
        const blockChances = [];
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
        const fake_orientation = new Vector(0, 1, 0);
        const fake_pos = {...new Vector(0, 0, 0), n: new Vector(0, 0, 0)};
        for(let item of blockChances) {
            let b = null;
            if(isNaN(item.name)) {
                b = BLOCK.fromName(item.name.toUpperCase());
            } else {
                b = BLOCK.fromId(parseInt(item.name));
            }
            if(!b || b.id < 0) throw 'error_invalid_block';
            if(b.deprecated) throw 'error_block_is_deprecated';
            if(b.item || b.next_part || b.previous_part || ['extruder', 'text', 'painting'].indexOf(b.style) >= 0) throw 'error_this_block_cannot_be_setted';
            //
            const block_id = b.id;
            const extra_data = BLOCK.makeExtraData(b, fake_pos, fake_orientation, null);
            if(extra_data) {
                item.extra_data = extra_data;
            }
            if(b.can_rotate) {
                item.rotate = fake_orientation;
            }
            item.block_id = block_id;
            item.name = b.name;
            // TODO: make this automatic (#water)
            item.is_fluid = b.is_fluid;
            item.is_water = b.is_water;
            item.is_lava = b.is_fluid && !b.is_water;
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
    async cmd_schematic(chat, player, cmd, args) {
        args = chat.parseCMD(args, ['string', 'string', 'string']);
        const action = args[1];
        let msg = null;
        //
        switch(action) {
            case 'save': {
                throw 'error_not_implemented';
                break;
            }
            case 'load': {
                let p = performance.now();
                const reader = new SchematicReader();
                const schem = await reader.read(args[2]);
                if(reader.blocks.size > 0) {
                    player._world_edit_copy = {
                        quboid: null,
                        blocks: reader.blocks,
                        fluids: reader.fluids,
                        player_pos: null
                    };
                }
                p = Math.round((performance.now() - p) * 1000) / 1000000;
                console.log('schematic version', schem.version);
                const size = new Vector(schem.size).toHash();
                msg = `... loaded (${reader.blocks.size} blocks, size: ${size}, load time: ${p} sec). Version: ${schem.version}. Paste it with //paste`;
                break;
            }
            default: {
                msg = 'error_invalid_command';
                break;
            }
        }
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);
    }

}