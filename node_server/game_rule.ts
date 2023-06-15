import { ObjectHelpers } from "@client/helpers.js";
import type { ServerWorld } from "server_world";

/** базовый размер чанка, для которого определена {@link GameRule.getRandomTickSpeedValue}*/
export const RANDOM_TICK_SPEED_CHUNK_SIZE = 16 * 16 * 40

export class GameRule {

    #world : ServerWorld;
    default_rules: {
        doDaylightCycle:    { default: boolean; type: string; };
        doWeatherCycle:     { default: boolean; type: string; };
        doMobSpawning:      { default: boolean; type: string; };
        pvp:                { default: boolean; type: string; };
        randomTickSpeed:    { default: number; type: string; };
        difficulty:         { default: number; type: string; };
        fluidTickRate:      { default: number; min: number; max: number; type: string; };
        lavaSpeed:          { default: number; min: number; max: number; type: string; };
        ambientLight:       { default: number; min: number; max: number; type: string; };
    };

    constructor(world) {
        this.#world = world;
        this.default_rules = {
            doDaylightCycle:    {default: true, type: 'boolean'}, // /gamerule doDaylightCycle false|true
            doWeatherCycle:     {default: true, type: 'boolean'},
            doMobSpawning:      {default: true, type: 'boolean'},
            pvp:                {default: true, type: 'boolean'},
            /** См. {@link getRandomTickSpeedValue} */
            randomTickSpeed:    {default: 3, type: 'float'},
            difficulty:         {default: 1, type: 'int'},
            fluidTickRate:      {default: 5, min: 1, max: 1000000, type: 'int'},
            lavaSpeed:          {default: 6, min: 1, max: 6, type: 'int'},
            ambientLight:       {default: 0, min: 0, max: 8, type: 'int'},
        };
    }

    getTable() {
        const result = ObjectHelpers.deepClone(this.default_rules)
        for(const [name, rule] of Object.entries(result) as [string, object][]) {
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

    /**
     * @return сколько в среднем рандомных тикеров вызывается за 1 тик в чанке размером {@link RANDOM_TICK_SPEED_CHUNK_SIZE}.
     * Если чанк другого размера - применяется поправка при вызове рандомных (и только рандомных) тикеров.
     */
    getRandomTickSpeedValue() : float {
        return this.getValue('randomTickSpeed')
    }

    // Set world game rule value
    async setValue(rule_code: string, strValue: string): Promise<boolean> {

        if(!(rule_code in this.default_rules)) {
            throw 'error_incorrect_rule_code';
        }

        const world = this.#world;
        const current_rules = world.info.rules;
        const default_rule = this.default_rules[rule_code];

        let value: any
        switch(default_rule.type) {
            case 'boolean': {
                value = this.parseBoolValue(strValue);
                break;
            }
            case 'float':
            case 'int': {
                value = default_rule.type === 'int' ? this.parseIntValue(strValue) : this.parseFloatValue(strValue)
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
            case 'ambientLight': {
                world.chunkManager.fluidWorld.queue[rule_code] = value;
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
    parseBoolValue(value: string): boolean {
        value = value.toLowerCase().trim();
        if(['true', 'false'].indexOf(value) < 0) {
            throw 'error_invalid_value_type';
        }
        return value == 'true';
    }

    //
    parseIntValue(strValue: string): int {
        const value = parseInt(strValue);
        if (isNaN(value) || !isFinite(value) || Math.round(value) !== value) {
            throw 'error_invalid_value_type';
        }
        return value;
    }

    parseFloatValue(strValue: string): float {
        const value = parseFloat(strValue);
        if (isNaN(value) || !isFinite(value)) {
            throw 'error_invalid_value_type';
        }
        return value;
    }

}