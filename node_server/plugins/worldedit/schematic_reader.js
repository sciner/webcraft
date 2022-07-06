import { BLOCK } from "../../../www/js/blocks.js";
import { Schematic } from "prismarine-schematic";
import { promises as fs } from 'fs';
import { Vector, VectorCollector } from "../../../www/js/helpers.js";

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
    async read(file_name) {
        file_name = `./plugins/worldedit/schematics/${file_name}`;
        const schematic = await Schematic.read(await fs.readFile(file_name))
        console.log('version', schematic.version);
        const not_found_blocks = new Map();
        const bpos = new Vector(0, 0, 0);
        const TEST_BLOCK = {id: BLOCK.fromName('TEST').id};
        const FLOWER_POT_BLOCK_ID = BLOCK.fromName('FLOWER_POT').id;
        // each all blocks
        await schematic.forEach((block, pos) => {
            bpos.copyFrom(pos);
            bpos.z *= -1;
            let name = this.parseBlockName(block);
            if(name == 'AIR') {
                return;
            }
            const b = BLOCK[name];
            let new_block = null;
            if(b) {
                new_block = this.createBlockFromSchematic(block, b);
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
    }

    //
    parseBlockName(block) {
        if(block.name == 'wall_sign') {
            block.name = 'oak_wall_sign';
        }
        block.on_wall = block.name.indexOf('_wall_sign') >= 0;
        if(block.on_wall) {
            block.name = block.name.replace('_wall_', '_');
        }
        if(block.name == 'wall_torch') {
            block.on_wall = true;
            block.name = 'torch';
        }
        let name = block.name.toUpperCase();
        if(name in this.replaced_names) {
            name = this.replaced_names[name];
        }
        return name;
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
            //
            if('open' in props) {
                setExtraData('opened', props.open);
            }
            // петли
            if('hinge' in props) {
                setExtraData('left', props.hinge == 'left');
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
                        if(['stairs', 'door', 'cocoa'].indexOf(b.style) >= 0) {
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
            if(b.style == 'sign') {
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

}