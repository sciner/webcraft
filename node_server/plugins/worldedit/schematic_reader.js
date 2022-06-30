import { BLOCK } from "../../../www/js/blocks.js";
import { Schematic } from "prismarine-schematic";
import { promises as fs } from 'fs';
import { Vector, VectorCollector } from "../../../www/js/helpers.js";
import { Console } from "console";

// SchematicReader...
export class SchematicReader {

    constructor() {
        this.blocks = new VectorCollector();
    }

    async read(file_name) {
        file_name = `./plugins/worldedit/schematics/${file_name}`;
        const schematic = await Schematic.read(await fs.readFile(file_name))
        const not_found_blocks = new Map();
        const bpos = new Vector(0, 0, 0);
        const TEST_BLOCK = {id: BLOCK.fromName('TEST').id};
        const FLOWER_POT_BLOCK_ID = BLOCK.fromName('FLOWER_POT').id;
        const replaced_names = {
            BARRIER:    'AIR',
            CAVE_AIR:   'AIR',
            LAVA:       'STILL_LAVA',
            WATER:      'STILL_WATER',
            WHEAT:      'WHEAT_SEEDS',
            COCOA:      'COCOA_BEANS'
        };
        // each all blocks
        await schematic.forEach((block, pos) => {
            bpos.copyFrom(pos);
            //
            block.is_wall_sign = block.name.indexOf('_wall_sign') >= 0;
            if(block.is_wall_sign) {
                block.name = block.name.replace('_wall_', '_');
            }
            let name = block.name.toUpperCase();
            //
            if(name in replaced_names) {
                name = replaced_names[name];
            }
            if(name == 'AIR') {
                return;
            }
            const b = BLOCK[name];
            let new_block = null;
            if(b) {
                new_block = this.createBlockFromSchematic(block, b);
            } else {
                if(name.indexOf('POTTED_') === 0) {
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
                }
            }
            if(!new_block) {
                if(!not_found_blocks.has(name)) {
                    not_found_blocks.set(name, name);
                }
                new_block = {...TEST_BLOCK};
                new_block.extra_data = {
                    name: name,
                    props: block._properties
                }
            }
            this.blocks.set(bpos, new_block);
        });
        console.log('Not found blocks: ', Array.from(not_found_blocks.keys()).join('; '));
    }

    //
    createBlockFromSchematic(block, b) {
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
            new_block.extra_data = null;
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
            // button
            if(b.is_button) {
                // { powered: false, facing: 'south', face: 'wall' }
                if('face' in props && 'facing' in props) {
                    const face = props.face;
                    if(face == 'wall') {
                        const facings = {south: 18, west: 22, north: 7, east: 13};
                        new_block.rotate = new Vector(0, 0, 0);
                        let x = facings[props.facing] || 0;
                        new_block.rotate.x = x;
                    } else {
                        const facings = ['south', 'west', 'north', 'east'];
                        new_block.rotate = new Vector(0, 0, 0);
                        new_block.rotate.x = Math.max(facings.indexOf(props.facing), 0);
                    }
                    return new_block;
                }
            }
            // rotate
            if(new_block.rotate && 'facing' in props) {
                const facings = ['south', 'west', 'north', 'east'];
                new_block.rotate.x = Math.max(facings.indexOf(props.facing), 0);
                if(['stairs', 'door', 'cocoa'].indexOf(b.style) >= 0) {
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
            // fluids
            if(b.is_fluid) {
                if('level' in props) {
                    setExtraData('level', props.level);
                }
            }
            // vine
            if(b.name == 'VINE') {
                // _properties: { west: false, up: false, south: false, north: true, east: false }
                const facings = ['south', 'west', 'north', 'east'/*, 'up'*/];
                new_block.rotate = new Vector(0, 0, 0);
                for(let f of facings) {
                    if(f in props && props[f]) {
                        new_block.rotate.x = (facings.indexOf(f) + 2) % 4;
                    }
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
                    const double_block = BLOCK.fromName(b.layering.full_block_name);
                    new_block = {id: double_block.id};
                }
            }
            // sign
            if(b.style == 'sign') {
                if(block.signText) {
                    setExtraData('text', block.signText);
                }
                if(block.is_wall_sign) {
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
        }
        return new_block;
    }

}