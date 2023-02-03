import { ArrayHelpers } from "../../www/js/helpers.js";

export class WorldTickStat {

    static SLIDING_WINDOW = 10000

    static DEFAULT_STAT_NAMES = ['chunks', 'players', 'mobs', 'drop_items', 'packet_reader_queue',
        'maps_clear', 'packets_queue_send', 'chunks_random_tick', 'actions_queue', 'fluid_queue',
        'db_fluid_save', 'auto_spawn_hostile_mobs', 'world_transaction_sync'];

    static DEFAULT_DECIMALS = {
        min:        3,
        avg:        3,
        sum:        0,
        'ms/sec':   1,
        default:    2
    }

    #history = new Array(20);
    #index = 0;

    constructor(stat_names = WorldTickStat.DEFAULT_STAT_NAMES, decimals = WorldTickStat.DEFAULT_DECIMALS) {
        this.stat_names = stat_names
        this.decimals   = decimals
        this.tps = 0;
        this.number = 0;
        this.pn = null;
        this.last = 0;
        this.total = 0;
        this.count = 0;
        this.min = Number.MAX_SAFE_INTEGER;
        this.max = 0;
        this.values = {}
        for(let stat_name of stat_names) {
            this.values[stat_name] = { min: Infinity, max: -Infinity, avg: 0, sum: 0 }
        }
        this.slidingBegin = performance.now()
        this._moveSlidingWindow() // call it twice to create new and old values
        this._moveSlidingWindow()
    }

    add(field) {
        const value = this.values[field];
        if (value) {
            const elapsed = performance.now() - this.pn_values;
            value.sum += elapsed;
            if (elapsed < value.min) value.min = elapsed;
            if (elapsed > value.max) value.max = elapsed;
            value.avg = value.sum / this.count;
            this.slidingCurrent[field] += elapsed;
        } else {
            console.error('invalid tick stat value: ' + field);
        }
        this.pn_values = performance.now();
    }

    start() {
        this.pn = performance.now();
        this.pn_values = performance.now();
        if (this.slidingBegin + WorldTickStat.SLIDING_WINDOW < this.pn) {
            this._moveSlidingWindow()
        }
    }

    end() {
        if(this.pn !== null) {
            // Calculate stats of elapsed time for ticks
            this.last = performance.now() - this.pn;

            this.#history[this.#index++ % this.#history.length] = this.last;
            this.tps = Math.min(1000 / (this.#history.reduce((a, b) => a + b) / this.#history.length), 20);

            this.total += this.last;
            this.count++;
            if (this.last < this.min) this.min = this.last;
            if (this.last > this.max) this.max = this.last;
        }
    }

    toTable() {
        const slidingWindowSeconds = (performance.now() - this.slidingBeginOld) * 0.001
        const displayNames = {}
        const tableValues = {}
        const valueLens = {}
        let row

        const that = this
        function addValue(colName, value) {
            const decimals = that.decimals[colName] ?? that.decimals.default ?? 2
            value = value.toFixed(decimals)
            row[colName] = value
            displayNames[colName] = colName
            valueLens[colName] = Math.max(valueLens[colName] ?? 0, value.length)
        }

        for(let [rowName, rowStats] of Object.entries(this.values)) {
            row = {}
            for(let [colName, value] of Object.entries(rowStats)) {
                addValue(colName, value)
            }
            if (slidingWindowSeconds) {
                const perSecond = (this.slidingOld[rowName] + this.slidingCurrent[rowName]) / slidingWindowSeconds
                addValue('ms/sec', perSecond)
            }
            tableValues[rowName] = row
        }

        const table = {}
        for(let [rowName, rowStats] of Object.entries(tableValues)) {
            let temp = []
            for(let [colName, value] of Object.entries(rowStats)) {
                temp.push(colName + ': ' + value.padStart(valueLens[colName]))
            }
            table[rowName] = temp.join('; ')
        }
        return table
    }

    _moveSlidingWindow() {
        this.slidingOld     = this.slidingCurrent
        this.slidingCurrent = ArrayHelpers.toObject(this.stat_names, (i, name) => name, 0)
        this.slidingBeginOld= this.slidingBegin
        this.slidingBegin   = performance.now()
    }
}