import { Vector, VectorCollector } from "../../../www/js/helpers.js";

import fs from "fs";
import { BuilgingTemplate } from "../../../www/js/terrain_generator/cluster/building_template.js";
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

        this.list = new Map();

        const insert = (name, pos1, pos2, door_bottom) => {
            const building = {
                name: name,
                world: {
                    pos1: pos1,
                    pos2: pos2,
                    door_bottom: door_bottom
                },
                meta: null,
                size: new Vector(0, 0, 0),
                door_pos: new Vector(0, 0, 0),
                blocks: [],
                rot: []
            }
            this.list.set(building.name, building);
        };

        for(let schema of Object.values(BuilgingTemplate.schemas)) {
            insert(schema.name, schema.world.pos1, schema.world.pos2, schema.world.door_bottom)
        }

    }

    //
    async onCmd(chat, player, cmd, args) {
        switch(args[1]) {
            case 'paste': {
                await this.paste(chat, player, cmd, args)
                break;
            }
            case 'save': {
                await this.save(chat, player, cmd, args)
                break;
            }
        }
    }

    // Copy building from current world and save result
    async save(chat, player, cmd, args) {

        //
        if(chat.world.info.title != config.building_schames_world_name) {
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
                rel_door_bottom.z - bpos.z + building.door_pos.z
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

        // Calling gzip method
        const json = JSON.stringify(building)
        fs.writeFileSync(file_name, json);

        // Update in memory
        BuilgingTemplate.addSchema(building)

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

        // throw 'error_deprecated';

        const copy_data = {
            blocks: new VectorCollector(),
            fluids: []
        };

        const mirror_x = false;
        const mirror_z = false;

        const building = BuilgingTemplate.fromSchema('e3290', BLOCK);

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

}