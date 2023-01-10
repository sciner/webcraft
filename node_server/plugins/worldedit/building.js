import { Vector, VectorCollector } from "../../../www/js/helpers.js";

import fs from "fs";
import { BuildingTemplate } from "../../../www/js/terrain_generator/cluster/building_template.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { ServerClient } from "../../../www/js/server_client.js";

//
export class WorldEditBuilding {

    /**
     * @param { import("../chat_worldedit.js").WorldEdit } worldedit_instance
     */
    constructor(worldedit_instance) {
        this.worldedit_instance = worldedit_instance;
        this.load();
    }

    // Load all buildings
    load() {

        this.list = new Map()

        for(let schema of BuildingTemplate.schemas.values()) {
            this._insert(schema.name, schema.world.pos1, schema.world.pos2, schema.world.door_bottom, schema.meta ?? null)
        }

    }

    _insert(name, pos1, pos2, door_bottom, meta) {
        const building = {
            name,
            world: {
                pos1,
                pos2,
                door_bottom
            },
            meta,
            size: new Vector(0, 0, 0),
            door_pos: new Vector(0, 0, 0),
            blocks: [],
            rot: []
        }
        this.list.set(building.name, building)
    }

    //
    async onCmd(chat, player, cmd, args) {
        switch(args[1]) {
            case 'paste': {
                await this.paste(chat, player, cmd, args)
                break;
            }
            case 'add': {
                await this.add(chat, player, cmd, args)
                break;
            }
            case 'save': {
                await this.save(chat, player, cmd, args)
                break;
            }
            case 'select': {
                await this.select(chat, player, cmd, args)
                break;
            }
            case 'go': {
                this.goToBuilding(chat, player, cmd, args)
                break;
            }
        }
    }

    // Add new building to registry
    async add(chat, player, cmd, args) {

        //
        if(!chat.world.isBuildingWorld()) {
            throw 'error_invalid_world';
        }

        const we = this.worldedit_instance
        const name = args[2]

        // getbuilding by name
        if(this.list.get(name)) {
            throw 'error_building_same_name_exists'
        }

        // make quboid info
        const qi = we.getCuboidInfo(player)

        const pos1_temp = new Vector(qi.pos1)
        const pos2_temp = new Vector(
            qi.pos1.x + (qi.volx - 1) * qi.signx,
            qi.pos1.y + (qi.voly - 1) * qi.signy,
            qi.pos1.z + (qi.volz - 1) * qi.signz
        )

        const pos1 = new Vector(
            Math.max(pos1_temp.x, pos2_temp.x),
            Math.min(pos1_temp.y, pos2_temp.y),
            Math.max(pos1_temp.z, pos2_temp.z)
        )

        const pos2 = new Vector(
            Math.min(pos1_temp.x, pos2_temp.x),
            Math.max(pos1_temp.y, pos2_temp.y),
            Math.min(pos1_temp.z, pos2_temp.z)
        )

        const door_bottom = new Vector(
            Math.round((pos1.x + pos2.x) / 2),
            1,
            Math.round((pos1.z + pos2.z) / 2)
        )

        const meta = {
            dt:                         new Date().toISOString(),
            draw_natural_basement:      true,
            air_column_from_basement:   true
        }
        const building = {name, pos1, pos2, door_bottom, meta}

        this._insert(building.name, building.pos1, building.pos2, building.door_bottom)

        // append building_schemas        
        const file_name = `./conf_world.json`
        let conf_world = fs.readFileSync(file_name)
        
        if(conf_world) {
            conf_world = JSON.parse(conf_world)
            if(!conf_world) {
                throw 'error_conf_world_corrupted'
            }
            conf_world.building_schemas.push(building)
            fs.writeFileSync(file_name, JSON.stringify(conf_world, null, 4))
        } else {
            throw 'error_conf_world_not_found'
        }

        await this.save(chat, player, cmd, args)

    }

    // Select building
    async select(chat, player, cmd, args) {

        //
        if(!chat.world.isBuildingWorld()) {
            throw 'error_invalid_world';
        }

        const we = this.worldedit_instance
        const name = args[2]

        // getbuilding by name
        const building = this.list.get(name)
        if(!building) throw 'building_not_found'

        player.pos1 = new Vector(building.world.pos1)
        player.pos2 = new Vector(building.world.pos2)

        // message to player chat
        const msg = `${name} building selected`
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id])

    }

    // Copy building from current world and save result
    async save(chat, player, cmd, args) {

        //
        if(!chat.world.isBuildingWorld()) {
            throw 'error_invalid_world';
        }

        const we = this.worldedit_instance;
        const copy_air = false;
        const name = args[2];
        const basement_y = 1;

        // getbuilding by name
        const building = this.list.get(name)
        if(!building) throw 'building_not_found';

        // make quboid info
        const qi = we.getCuboidInfo({
            pos1: building.world.pos1,
            pos2: building.world.pos2
        });

        // copy blocks in quboid
        const copy_data = await we.copy(qi, building.world.pos1, chat.world);
        building.size = new Vector(copy_data.quboid.volx, copy_data.quboid.voly, copy_data.quboid.volz)

        const pos1 = building.world.pos1
        const rel_door_bottom = building.world.door_bottom.sub(pos1)

        // calc door_pos
        building.door_pos.set(-rel_door_bottom.x, rel_door_bottom.y, -rel_door_bottom.z);

        // clear blocks
        building.blocks = [];
        if('rot' in building.rot) {
            delete(building.rot)
        }

        // convert blocks to building blocks
        for(let [bpos, item] of copy_data.blocks.entries()) {
            if([209, 210].includes(item.id)) continue;
            if(item.id == 0 && !copy_air) continue;
            const move = new Vector(
                rel_door_bottom.x - bpos.x,
                bpos.y - rel_door_bottom.y + building.door_pos.y - (basement_y - pos1.y),
                rel_door_bottom.z - bpos.z // + building.door_pos.z
            );
            const block = {
                move,
                block_id: item.id
            };
            if(item.extra_data) {
                block.extra_data = item.extra_data
            }
            if(item.rotate) {
                block.rotate = item.rotate
            }
            building.blocks.push(block)
        }

        // export
        const file_name = `./data/building_schema/${building.name}.json`;

        // Write building to file
        const json = JSON.stringify(building)
        fs.writeFileSync(file_name, json)

        // Update in memory
        BuildingTemplate.addSchema(building)

        // Notify all players in all worlds
        for(let w of Qubatch.worlds.values()) {
            w.sendAll([{
                name: ServerClient.CMD_BUILDING_SCHEMA_ADD,
                data: {
                    list: [building]
                }
            }]);
        }

        // message to player chat
        const msg = `${copy_data.blocks.size} building block(s) saved`;
        chat.sendSystemChatMessageToSelectedPlayers(msg, [player.session.user_id]);

    }

    //
    async paste(chat, player, cmd, args) {

        const we = this.worldedit_instance;
        const name = args[1];
        const direction = Math.abs((args[2] | 0)) % 4;

        throw 'error_deprecated';

        const copy_data = {
            blocks: new VectorCollector(),
            fluids: []
        };

        const mirror_x = false;
        const mirror_z = false;

        const building = BuildingTemplate.fromSchema(name, BLOCK);

        for(let block of building.rot[direction]) {
            const item = {
                id: block.block_id
            }
            for(let prop of ['extra_data', 'rotate']) {
                if(prop in block) {
                    item[prop] = block[prop];
                }
            }
            const pos = new Vector(0, 0, 0).addByCardinalDirectionSelf(block.move, direction + 2, mirror_x, mirror_z);
            copy_data.blocks.set(pos, item);
        }

        //
        await we.cmd_paste(chat, player, cmd, args, copy_data);

    }

    goToBuilding(chat, player, cmd, args) {

        //
        if(!chat.world.isBuildingWorld()) {
            throw 'error_invalid_world';
        }

        const we = this.worldedit_instance;
        const name = args[2];

        // getbuilding by name
        const building = this.list.get(name)
        if(!building) throw 'building_not_found';

        const pos = new Vector(building.world.door_bottom.x + .5, 1, 4.5)
        player.teleport({place_id: null, pos});

    }


}