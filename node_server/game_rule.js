import { ObjectHelpers } from "../www/js/helpers.js";

export class GameRule {

    #world;

    constructor(world) {
        this.#world = world;
        this.default_rules = {
            doDaylightCycle:    {default: true, type: 'boolean'}, // /gamerule doDaylightCycle false|true
            doWeatherCycle:     {default: true, type: 'boolean'},
            doMobSpawning:     {default: true, type: 'boolean'},
            pvp:                {default: true, type: 'boolean'},
            randomTickSpeed:    {default: 3, type: 'int'},
            difficulty:         {default: 1, type: 'int'},
            fluidTickRate:      {default: 5, min: 1, max: 1000000, type: 'int'},
            lavaSpeed:          {default: 6, min: 1, max: 6, type: 'int'}
        };
    }

    getTable() {
        const result = ObjectHelpers.deepClone(this.default_rules)
        for(const [name, rule] of Object.entries(result)) {
            const obj = {
                value:  this.getValue(name),
                ...rule
            }
            result[name] = JSON.stringify(obj)
        }
        return result
    }

    // Return game rule
    getValue(rule_code) {
        const world = this.#world;
        if(rule_code in this.default_rules) {
            return world.info.rules[rule_code] ?? this.default_rules[rule_code].default;
        }
        throw 'error_incorrect_rule_code';
    }

    // Set world game rule value
    async setValue(rule_code, value) {

        if(!(rule_code in this.default_rules)) {
            throw 'error_incorrect_rule_code';
        }

        const world = this.#world;
        const current_rules = world.info.rules;
        const default_rule = this.default_rules[rule_code];

        switch(default_rule.type) {
            case 'boolean': {
                value = this.parseBoolValue(value);
                break;
            }
            case 'int': {
                value = this.parseIntValue(value);
                if('min' in default_rule) {
                    if(value < default_rule.min) throw `error_invalid_rule_range_min|${default_rule.min}`;
                }
                if('max' in default_rule) {
                    if(value > default_rule.max) throw `error_invalid_rule_range_max|${default_rule.max}`;
                }
                break;
            }
            default: {
                throw 'error_incorrect_rule_type';
            }
        }

        //
        switch(rule_code) {
            case 'lavaSpeed':
            case 'fluidTickRate': {
                world.chunkManager.fluidWorld.queue[rule_code] = value;
                break;
            }
            case 'doDaylightCycle': {
                if(value) {
                    delete(current_rules.doDaylightCycleTime);
                } else {
                    // fix current day_time
                    world.updateWorldCalendar();
                    current_rules.doDaylightCycleTime = world.info.calendar.day_time;
                }
                break;
            }
        }

        // Apply changes if not equal with current
        if(current_rules[rule_code] == value) {
            return false;
        }
        current_rules[rule_code] = value;

        // Save to DB and send to players
        await world.db.saveGameRules(world.info.guid, world.info.rules);
        world.sendUpdatedInfo();
        world.chat.sendSystemChatMessageToSelectedPlayers(`Game rule '${rule_code}' changed to '${value}'`, Array.from(world.players.keys()));

        //
        if(rule_code == 'lavaSpeed') {
            world.chunkManager.fluidWorld.queue
        }

        return true;

    }

    //
    parseBoolValue(value) {
        value = value.toLowerCase().trim();
        if(['true', 'false'].indexOf(value) < 0) {
            throw 'error_invalid_value_type';
        }
        return value == 'true';
    }

    //
    parseIntValue(value) {
        value = parseInt(value);
        if (isNaN(value) || !isFinite(value)) {
            throw 'error_invalid_value_type';
        }
        return value;
    }

    //
    parseIntValue(value) {
        value = parseInt(value);
        if (isNaN(value) || !isFinite(value)) {
            throw 'error_invalid_value_type';
        }
        return value;
    }

}