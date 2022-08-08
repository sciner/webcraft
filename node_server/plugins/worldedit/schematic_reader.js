import { BLOCK } from "../../../www/js/blocks.js";
import { Schematic } from "prismarine-schematic";
import { promises as fs } from 'fs';
import { Vector, VectorCollector } from "../../../www/js/helpers.js";
import { RailShape } from "../../../www/js/block_type/rail_shape.js";

const facings4 = ['north', 'west', 'south', 'east'];
const facings6 = ['north', 'west', 'south', 'east', /*'up', 'down'*/];

const SIX_VECS = {
    south: new Vector(7, 0, 0),
    west: new Vector(22, 0, 0),
    north: new Vector(18, 0, 0),
    east: new Vector(13, 0, 0),
    up: new Vector(0, 1, 0),
    down: new Vector(0, -1, 0)
};

// SchematicReader...
export class SchematicReader {

    constructor() {
        this.blocks = new VectorCollector();
        this.replaced_names = {
            BARRIER:    'AIR',
            CAVE_AIR:   'AIR',
            LAVA:       'STILL_LAVA',
            WATER:      'STILL_WATER',
            WHEAT:      'WHEAT_SEEDS',
            COCOA:      'COCOA_BEANS'
        };
    }

    // Read schematic file
    async read(orig_file_name) {

        let file_name = `./plugins/worldedit/schematics/${orig_file_name}`;

        // Check schem file exists and try extension append
        const fileExists = path => fs.stat(path).then(() => true, () => false);
        if(!await fileExists(file_name)) {
            if(orig_file_name.indexOf('.') < 0) {
                let found = false;
                for(let ext of ['schem', 'schematic', 'schema']) {
                    let next_file_name = `${file_name}.${ext}`;
                    if(await fileExists(next_file_name)) {
                        found = true;
                        file_name = next_file_name;
                        break;
                    }
                }
                if(!found) {
                    throw 'error_schem_file_not_found';
                }
            }
        }

        // read schematic
        const schematic = await Schematic.read(await fs.readFile(file_name));

        // Prepare BlockEntities for fast search
        const BlockEntities = new VectorCollector();
        const bePos = new Vector(0, 0, 0);
        for(let i = 0; i < schematic.blockEntities.length; i++) {
            const item = schematic.blockEntities[i];
            BlockEntities.set(bePos.set(item.Pos[0], item.Pos[1], item.Pos[2]), item);
        }

        const not_found_blocks = new Map();
        const bpos = new Vector(0, 0, 0);
        const TEST_BLOCK = {id: BLOCK.fromName('TEST').id};
        const FLOWER_POT_BLOCK_ID = BLOCK.fromName('FLOWER_POT').id;
        // each all blocks
        const ep = new Vector(0, 0, 0);
        await schematic.forEach((block, pos) => {
            bpos.copyFrom(pos);
            bpos.z *= -1;
            let {name, extra_data} = this.parseBlockName(block);
            if(name == 'AIR') {
                return;
            }
            let b = BLOCK[name];
            let new_block = null;
            if(b) {
                // read entity props
                let readEntityProps = false;
                if(b.is_chest) {
                    readEntityProps = true;
                } else if(b.is_sign) {
                    readEntityProps = true;
                } else if(b.name == 'ITEM_FRAME') {
                    readEntityProps = true;
                } else if(b.is_banner) {
                    readEntityProps = true;
                }
                if(readEntityProps) {
                    ep.copyFrom(pos).subSelf(schematic.offset);
                    block.entities = BlockEntities.get(ep);
                }
                new_block = this.createBlockFromSchematic(block, b, extra_data);
            } else {
                if(name.indexOf('POTTED_') === 0) {
                    // POTTED_PINK_TULIP - ALLIUM
                    // POTTED_WITHER_ROSE - LILY OF THE VALEY
                    const in_pot_block_name = name.substring(7);
                    const in_pot_block = BLOCK.fromName(in_pot_block_name);
                    if(in_pot_block && in_pot_block.id > 0) {
                        new_block = {
                            id: FLOWER_POT_BLOCK_ID,
                            extra_data: {item: {id: in_pot_block.id}}
                        };
                    }
                } else if(name.indexOf('INFESTED_') === 0) {
                    // e.g. INFESTED_STONE_BRICKS
                    const name2 = name.substring(9);
                    const b2 = BLOCK.fromName(name2);
                    if(b2 && b2.id > 0) {
                        new_block = {
                            id: b2.id,
                            extra_data: {infested: true}
                        };
                    }
                } else if(name.endsWith('_ANVIL')) {
                    const b2 = BLOCK.fromName('ANVIL');
                    if(b2 && b2.id > 0) {
                        new_block = {
                            id: b2.id,
                            extra_data: {damage: 0}
                        };
                        if(name.startsWith('CHIPPED_')) new_block.extra_data.damage = 1;
                        if(name.startsWith('DAMAGED_')) new_block.extra_data.damage = 2;
                    }
                }
            }
            // If not implemented block 
            if(!new_block) {
                if(!not_found_blocks.has(name)) {
                    not_found_blocks.set(name, name);
                }
                // replace with TEST block and store original to his extra_data
                new_block = {...TEST_BLOCK};
                new_block.extra_data = {
                    name: name,
                    props: block._properties
                }
            }
            this.blocks.set(bpos, new_block);
        });
        console.log('Not found blocks: ', Array.from(not_found_blocks.keys()).join('; '));
        return schematic;
    }

    //
    parseBlockName(block) {
        let extra_data = null;
        if(block.name == 'wall_sign') {
            block.name = 'oak_wall_sign';
        }
        if(block.name == 'wall_torch') {
            block.on_wall = true;
            block.name = 'torch';
        } else if(block.name.endsWith('_sign')) {
            block.on_wall = block.name.endsWith('_wall_sign');
            if(block.on_wall) {
                block.name = block.name.replace('_wall_', '_');
            }
        } else if(block.name.endsWith('_banner')) {
            block.on_wall = block.name.endsWith('_wall_banner');
            if(block.on_wall) {
                block.name = block.name.replace('_wall_', '_');
            }
        }
        //
        let name = block.name.toUpperCase();
        if(name in this.replaced_names) {
            name = this.replaced_names[name];
        }
        return {name, extra_data};
    }

    //
    createBlockFromSchematic(block, b, extra_data) {
        const props = block._properties;
        let new_block = {
            id: b.id
        };
        if(new_block.id == 0) {
            return new_block;
        }
        if(b.item || b.style == 'extruder' || b.style == 'text') {
            return null;
        }
        if(b.is_chest) {
            new_block.extra_data = { can_destroy: true, slots: {} };
        } else if(b.tags.indexOf('sign') >= 0) {
            new_block.extra_data = new_block.extra_data || null;
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
        if(extra_data) {
            for(let k in extra_data) {
                setExtraData(k, extra_data[k]);
            }
        }
        // block entities
        if(block.entities) {
            if(b.is_chest) {
                const chest_extra_data = this.parseChestExtraData(block.entities);
                if(chest_extra_data) {
                    new_block.extra_data = chest_extra_data;
                }
            } else if(b.is_sign) {
                // text
                let texts = Array(4);
                let formatted_text = [];
                let text_names = ['Text1', 'Text2', 'Text3', 'Text4'];
                for(let i in text_names) {
                    const t = text_names[i];
                    if(t in block.entities) {
                        const temp = JSON.parse(block.entities[t]);
                        texts[i] = temp?.text || '';
                        formatted_text[i] = temp;
                    }
                }
                setExtraData('text', texts.join('\r'));
                setExtraData('formatted_text', formatted_text);
                // color
                if('Color' in block.entities) {
                    setExtraData('color', block.entities.Color);
                }
                // glowing
                if('GlowingText' in block.entities && block.entities.GlowingText) {
                    setExtraData('glowing_text', block.entities.GlowingText);
                }
            } else if(b.is_banner) {
                if('Patterns' in block.entities) {
                    setExtraData('patterns', block.entities.Color);
                }
            }
            // console.log(b.name, block.entities);
        }
        //
        if(props) {
            // button
            if(b.is_button) {
                if(b.tags.indexOf('rotate_by_pos_n_12') >= 0) {
                    if('face' in props && 'facing' in props) {
                        // ceiling wall floor
                        if(props.face == 'ceiling') {
                            new_block.rotate.x = Math.max(facings4.indexOf(props.facing), 0);
                            new_block.rotate.y = -1;
                        } else if(props.face == 'floor') {
                            new_block.rotate.x = Math.max(facings4.indexOf(props.facing), 0);
                            new_block.rotate.y = 1;
                        } else {
                            new_block.rotate = SIX_VECS[props.facing];
                        }
                    }
                }
                return new_block;
            }
            // lantern (подвешен)
            if('hanging' in props) {
                if(!new_block.rotate) {
                    new_block.rotate = {x: 0, y: 0.9, z: 0};
                }
                new_block.rotate.y = props.hanging ? -1 : 1;
            }
            // banner
            if('rotation' in props) {
                if(!new_block.rotate) {
                    new_block.rotate = {x: 0, y: 1, z: 0};
                }
                new_block.rotate.x = (((parseInt(props.rotation) + 8) % 16) / 16) * 4;
            }
            //
            if('open' in props) {
                setExtraData('opened', props.open);
            }
            // петли
            if('hinge' in props) {
                setExtraData('left', props.hinge == 'left');
            }
            // рельсы
            if('shape' in props) {
                const shape_id = RailShape[props.shape.toUpperCase()];
                if(shape_id !== undefined) {
                    setExtraData('shape', shape_id);
                }
            }
            // rotate
            if(new_block.rotate) {
                // wesn
                if('west' in props && 'east' in props && 'south' in props && 'north' in props) {
                    // vine
                    if(b.name == 'VINE') {
                        // _properties: { west: false, up: false, south: false, north: true, east: false }
                        new_block.rotate = new Vector(0, 0, 0);
                        for(let f of facings6) {
                            if(f in props && props[f]) {
                                new_block.rotate.x = (facings6.indexOf(f) + 2) % 4;
                            }
                        }
                    } else {
                        new_block.rotate = new Vector(0, 0, 0);
                        for(let f of facings4) {
                            if(f in props && props[f]) {
                                new_block.rotate.x = (facings4.indexOf(f) + 1) % 4;
                            }
                        }
                    }
                }
                // facing
                if('facing' in props) {
                    if(b.tags.indexOf('rotate_by_pos_n_6') >= 0) {
                        new_block.rotate = SIX_VECS[props.facing].clone();
                    } else {
                        new_block.rotate.x = Math.max(facings4.indexOf(props.facing), 0);
                        if(['stairs', 'door', 'cocoa', 'anvil'].indexOf(b.style) >= 0) {
                            new_block.rotate.x = (new_block.rotate.x + 2) % 4;
                        }
                        new_block.rotate.y = 0;
                    }
                }
            }
            // trapdoors and doors
            // top|bottom|lower|upper
            if('half' in props) {
                switch(props.half) {
                    case 'top': {
                        setExtraData('point', {x: 0, y: 0.9, z: 0});
                        break;
                    }
                    case 'bottom': {
                        if(b.has_head) {
                            //
                        } else {
                            setExtraData('point', {x: 0, y: 0.1, z: 0});
                        }
                        break;
                    }
                    case 'upper': {
                        if(b.has_head) {
                            setExtraData('is_head', true);
                        } else {
                            setExtraData('point', {x: 0, y: 0.9, z: 0});
                        }
                        break;
                    }
                }
            }
            // bed
            if(b.style == 'bed') {
                if('part' in props) {
                    const is_head = props.part == 'head';
                    setExtraData('is_head', is_head);
                    new_block.rotate.x = (new_block.rotate.x + 2) % 4;
                }
            }
            // fluids
            if(b.is_fluid) {
                if('level' in props) {
                    setExtraData('level', props.level);
                }
            }
            // COCOA_BEANS | WHEAT
            if('age' in props && (b.extra_data && 'stage' in b.extra_data)) {
                setExtraData('stage', props.age);
            }
            // part: 'head', occupied: false, facing: 'north' }
            // _properties: { part: 'foot
            // slabs
            if(b.layering && b.layering.slab && 'type' in props) {
                if(props.type == 'top') {
                    setExtraData('point', {x: 0, y: 0.9, z: 0});
                } else if(props.type == 'bottom') {
                    setExtraData('point', {x: 0, y: 0.1, z: 0});
                } else if(props.type == 'double') {
                    const double_block = b.layering.full_block_name ? BLOCK.fromName(b.layering.full_block_name) : b;
                    new_block = {id: double_block.id};
                    if(double_block.layering) {
                        setExtraData('height', 1);
                        setExtraData('point', new Vector(0, 0, 0));
                    }
                }
            }
            // sign
            if(b.tags.indexOf('sign') >= 0) {
                if(block.signText) {
                    setExtraData('text', block.signText);
                }
                if(block.on_wall) {
                    new_block.rotate.y = 0;
                }
            }
            // torch
            if(b.style == 'torch') {
                if(block.on_wall) {
                    new_block.rotate.y = 0;
                }
            }
            // log
            if(b.tags.indexOf('rotate_by_pos_n') >= 0 && 'axis' in props) {
                // axis: x|y|z
                switch(props.axis) {
                    case 'x': {
                        new_block.rotate = new Vector(13, 0, 0);
                        break;
                    }
                    case 'y': {
                        new_block.rotate = new Vector(0, 1, 0);
                        break;
                    }
                    case 'z': {
                        new_block.rotate = new Vector(7, 0, 0);
                        break;
                    }
                }
            }
            // candles
            if('candles' in props) {
                setExtraData('candles', parseInt(props.candles));
            }
            if('lit' in props) {
                setExtraData('lit', props.lit);
            }
            // bamboo
            if(b.name == 'BAMBOO') {
                switch(props?.leaves) {
                    case 'none': {
                        if('extra_data' in new_block) {
                            delete(new_block.extra_data);
                        }
                        break;
                    }
                    case 'small': {
                        setExtraData('stage', 1);
                        setExtraData('notick', true);
                        break;
                    }
                    case 'large': {
                        setExtraData('stage', 2);
                        setExtraData('notick', true);
                        break;
                    }
                }
            }
        }
        return new_block;
    }

    parseChestExtraData(entities) {
        if(!entities || !entities.Items) {
            return null;
        }
        const chest_extra_data = {
            can_destroy: true,
            slots: {}
        };
        for(let i = 0; i < entities.Items.length; i++)  {
            const item = entities.Items[i];
            let chest_item_name = item.id.split(':').pop();
            if(chest_item_name) {
                const slot_index = item.Slot;
                chest_item_name = chest_item_name.toUpperCase();
                const chest_item_block = BLOCK.fromName(chest_item_name);
                if(chest_item_block && chest_item_block.id > 0) {
                    const count = item.Count;
                    if(count > 0) {
                        const tag = item.tag ?? null;
                        const chest_slot = BLOCK.convertItemToDBItem(chest_item_block);
                        chest_slot.count = count;
                        if(tag) {
                            chest_slot.tag = tag;
                        }
                        chest_extra_data.slots[slot_index] = chest_slot;
                    }
                } else {
                    const chest_slot = BLOCK.convertItemToDBItem(BLOCK.fromName('TEST'));
                    chest_slot.count = 1;
                    chest_slot.extra_data = {chest_slot: item};
                    chest_extra_data.slots[slot_index] = chest_slot;
                }
            }
        }
        return chest_extra_data;
    }

}