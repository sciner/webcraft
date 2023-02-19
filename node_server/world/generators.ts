import { Vector } from "../../www/src/helpers.js";

export class WorldGenerators {

    //
    static strictType(value, strict_type) {
        switch(strict_type) {
            case 'int': {
                return Math.round(value);
            }
            case 'float': {
                return parseFloat(value);
            }
            case 'boolean': {
                return !!value;
            }
            default: {
                throw `invalid_generator_option_type|${strict_type}`;
            }
        }
    }
    
    //
    static validateAndFixOptions(params) {
        if(!('id' in params)) {
            throw 'error_invalid_generator';
        }
        const generator = WorldGenerators.getByID(params.id);
        if(!generator) {
            throw 'error_invalid_generator';
        }
        const resp = {
            id: generator.id,
            pos_spawn: null,
            options: {},
            rules: {},
            cluster_size: new Vector(generator.cluster_size ?? WorldGenerators.list[0].cluster_size)
        };
        // pos spawn
        if('pos_spawn' in params) {
            resp.pos_spawn = params.pos_spawn ?? generator.pos_spawn;
        }
        if(!resp.pos_spawn || !('x' in resp.pos_spawn) || !('y' in resp.pos_spawn) || !('z' in resp.pos_spawn)) {
            resp.pos_spawn = generator.pos_spawn;
        }
        resp.pos_spawn = new Vector(resp.pos_spawn);
        // rules
        for(let name in generator.rules) {
            resp.rules[name] = generator.rules[name];
        }
        if('rules' in params) {
            for(let name in params.rules) {
                if(name in generator.rules) {
                    resp.rules[name] = params.rules[name];
                }
            }
        }
        // options
        for(let name in generator.options) {
            const option = generator.options[name];
            resp.options[name] = WorldGenerators.strictType(option.default_value, option.strict_type);
        }
        if('options' in params) {
            for(let name in params.options) {
                if(!(name in generator.options)) {
                    throw 'error_unknown_generator_option';
                }
                const option = generator.options[name];
                const value = WorldGenerators.strictType(params.options[name], option.strict_type);
                //
                switch(option.type) {
                    case 'checkbox': {
                        // do notning
                        break;
                    }
                    case 'select': {
                        let found = false;
                        for(let op of option.options) {
                            if(value == WorldGenerators.strictType(op.value, option.strict_type)) {
                                found = true;
                                break;
                            }
                        }
                        if(!found) {
                            throw `error_invalid_generator_option_value|${name}`
                        }
                        break;
                    }
                    default: {
                        throw `error_invalid_generator_option_type|${option.type}`;
                    }
                }
                resp.options[name] = value;
            }
        }
        return resp;
    }

    //
    static getByID(id) {
        for(let gen of WorldGenerators.list) {
            if(gen.id == id) {
                return gen;
            }
        }
        return null;
    }

    //
    static list = [
        {
            "id": "biome2",
            "title": "Стандартный",
            "pos_spawn": {"x": 0, "y": 120, "z": 0},
            "rules": {
                "portals": true
            },
            "cluster_size": {"x": 128, "y": 256, "z": 128},
            "options": {
                "auto_generate_mobs": {
                    "title": "Спавнить мобов",
                    "default_value": true,
                    "type": "checkbox",
                    "strict_type": "boolean"
                },
                "keep_inventory_on_dead": {
                    "title": "Keep inventory on dead",
                    "default_value": true,
                    "type": "checkbox",
                    "strict_type": "boolean"
                },
                "bonus_chest": {
                    "title": "Bonus chest",
                    "default_value": false,
                    "type": "checkbox",
                    "strict_type": "boolean"
                },
                "generate_bottom_caves_lava": {
                    "title": "Generate lava in bottom caves",
                    "default_value": false,
                    "type": "checkbox",
                    "strict_type": "boolean"
                },
                "random_spawn_radius": {
                    "title": "Random spawn radius",
                    "type": "select",
                    "strict_type": "int",
                    "default_value": "50",
                    "options": [
                        {"value": "0", "title": "0"},
                        {"value": "50", "title": "50"},
                        {"value": "100", "title": "100"},
                        {"value": "200", "title": "200"},
                        {"value": "500", "title": "500"},
                        {"value": "1000", "title": "1000"},
                        {"value": "2000", "title": "2000"},
                        {"value": "5000", "title": "5000"},
                        {"value": "10000", "title": "10000"},
                        {"value": "50000", "title": "50000"},
                        {"value": "250000", "title": "250000"},
                        {"value": "1000000", "title": "1000000"}
                    ]
                },
                "sapling_speed_multipliyer": {
                    "title": "Sapling growth multiplier",
                    "type": "select",
                    "strict_type": "float",
                    "default_value": "1",
                    "options": [
                        {"value": "0.25", "title": "0.25"},
                        {"value": "0.5", "title": "0.5"},
                        {"value": "1", "title": "1"},
                        {"value": "2", "title": "2"},
                        {"value": "4", "title": "4"},
                        {"value": "8", "title": "8"},
                        {"value": "16", "title": "16"}
                    ]
                },
                "tool_durability": {
                    "title": "Tool durability",
                    "type": "select",
                    "strict_type": "float",
                    "default_value": "1",
                    "options": [
                        {"value": "0.5", "title": "x0.5"},
                        {"value": "1", "title": "x1"},
                        {"value": "2", "title": "x2"},
                        {"value": "4", "title": "x4"},
                        {"value": "8", "title": "x8"}
                    ]
                },
                "tool_mining_speed": {
                    "title": "Tool mining speed",
                    "type": "select",
                    "strict_type": "float",
                    "default_value": "1",
                    "options": [
                        {"value": "0.5", "title": "x0.5"},
                        {"value": "1", "title": "x1"},
                        {"value": "2", "title": "x2"},
                        {"value": "4", "title": "x4"},
                        {"value": "8", "title": "x8"}
                    ]
                }
            }
        },
        {
            "id": "biome3",
            "title": "Улучшенный",
            "pos_spawn": {"x": 0, "y": 120, "z": 0},
            "rules": {
                "portals": true
            },
            "cluster_size": {"x": 256, "y": 200, "z": 256},
            "options": {
                "auto_generate_mobs": {
                    "title": "Спавнить мобов",
                    "default_value": true,
                    "type": "checkbox",
                    "strict_type": "boolean"
                },
                "keep_inventory_on_dead": {
                    "title": "Keep inventory on dead",
                    "default_value": true,
                    "type": "checkbox",
                    "strict_type": "boolean"
                },
                "bonus_chest": {
                    "title": "Bonus chest",
                    "default_value": false,
                    "type": "checkbox",
                    "strict_type": "boolean"
                },
                "generate_bottom_caves_lava": {
                    "title": "Generate lava in bottom caves",
                    "default_value": false,
                    "type": "checkbox",
                    "strict_type": "boolean"
                },
                "generate_big_caves": {
                    "title": "Generate big caves",
                    "default_value": false,
                    "type": "checkbox",
                    "strict_type": "boolean"
                },
                "random_spawn_radius": {
                    "title": "Random spawn radius",
                    "type": "select",
                    "strict_type": "int",
                    "default_value": "50",
                    "options": [
                        {"value": "0", "title": "0"},
                        {"value": "50", "title": "50"},
                        {"value": "100", "title": "100"},
                        {"value": "200", "title": "200"},
                        {"value": "500", "title": "500"},
                        {"value": "1000", "title": "1000"},
                        {"value": "2000", "title": "2000"},
                        {"value": "5000", "title": "5000"},
                        {"value": "10000", "title": "10000"},
                        {"value": "50000", "title": "50000"},
                        {"value": "250000", "title": "250000"},
                        {"value": "1000000", "title": "1000000"}
                    ]
                },
                "sapling_speed_multipliyer": {
                    "title": "Sapling growth multiplier",
                    "type": "select",
                    "strict_type": "float",
                    "default_value": "1",
                    "options": [
                        {"value": "0.25", "title": "0.25"},
                        {"value": "0.5", "title": "0.5"},
                        {"value": "1", "title": "1"},
                        {"value": "2", "title": "2"},
                        {"value": "4", "title": "4"},
                        {"value": "8", "title": "8"},
                        {"value": "16", "title": "16"}
                    ]
                },
                "tool_durability": {
                    "title": "Tool durability",
                    "type": "select",
                    "strict_type": "float",
                    "default_value": "1",
                    "options": [
                        {"value": "0.5", "title": "x0.5"},
                        {"value": "1", "title": "x1"},
                        {"value": "2", "title": "x2"},
                        {"value": "4", "title": "x4"},
                        {"value": "8", "title": "x8"}
                    ]
                },
                "tool_mining_speed": {
                    "title": "Tool mining speed",
                    "type": "select",
                    "strict_type": "float",
                    "default_value": "1",
                    "options": [
                        {"value": "0.5", "title": "x0.5"},
                        {"value": "1", "title": "x1"},
                        {"value": "2", "title": "x2"},
                        {"value": "4", "title": "x4"},
                        {"value": "8", "title": "x8"}
                    ]
                }
            }
        },
        {
            "id": "flat",
            "title": "Плоский мир",
            "pos_spawn": {"x": 0, "y": 1, "z": 0},
            "rules": {
                "portals": false
            }
        },
        {
            "id": "city",
            "title": "Город 1",
            "pos_spawn": {"x": 0, "y": 120, "z": 0},
            "rules": {
                "portals": false
            }
        },
        {
            "id": "city2",
            "title": "Город 2",
            "pos_spawn": {"x": 0, "y": 120, "z": 0},
            "rules": {
                "portals": false
            }
        },
        {
            "id": "bottom_caves",
            "title": "Пещеры нижнего мира",
            "pos_spawn": {"x": 0, "y": 32, "z": 0},
            "rules": {
                "portals": false
            }
        },
        {
            "id": "test_trees",
            "title": "test_trees",
            "pos_spawn": {"x": 0, "y": 32, "z": 0},
            "rules": {
                "portals": false
            }
        }
    ];

}