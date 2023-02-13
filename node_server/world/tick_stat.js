import { ArrayHelpers } from '../../www/js/helpers.js';

export class WorldTickStat {
    static SLIDING_WINDOW = 10000;

    static DEFAULT_STAT_NAMES = [
        'chunks.tick',
        'player.preTick',
        'tickChunkQueue',
        'player.postTick',
        'mobs',
        'drop_items',
        'packet_reader_queue',
        'maps_clear',
        'packets_queue_send',
        'chunks_random_tick',
        'actions_queue',
        'fluid_queue',
        'db_fluid_save',
        'auto_spawn_hostile_mobs',
        'world_transaction_sync',
    ];

    static DEFAULT_DECIMALS = {
        min: 3,
        avg: 3,
        sum: 0,
        'ms/sec': 1,
        default: 2,
    };

    #history = new Array(20);
    #index = 0;

    constructor(
        stat_names = WorldTickStat.DEFAULT_STAT_NAMES,
        decimals = WorldTickStat.DEFAULT_DECIMALS,
    ) {
        this.stat_names = [...stat_names];
        this.decimals = decimals;
        this.tps = 0;
        this.number = 0;
        this.pn = null;
        this.last = 0;
        this.total = 0;
        this.count = 0;
        this.min = Number.MAX_SAFE_INTEGER;
        this.max = 0;
        this.values = {};
        this.started = null;
        for (let stat_name of stat_names) {
            this.values[stat_name] = this._createValue();
        }
        this.valuesArray = Object.values(this.values);
        this._moveSlidingWindow(); // call it twice to create new and old values
        this._moveSlidingWindow();
    }

    add(field, allowAdding = false) {
        let value = this.values[field];
        if (!value) {
            if (allowAdding) {
                this.stat_names.push(field);
                value = this._createValue();
                this.values[field] = value;
                this.valuesArray.push(value);
                this.slidingOld.values[field] = this._createSlidingValue();
                this.slidingCurrent.values[field] = this._createSlidingValue();
            } else {
                console.error('invalid tick stat value: ' + field);
                this.pn_values = performance.now();
                return;
            }
        }

        const elapsed = performance.now() - this.pn_values;
        value.sum += elapsed;
        if (elapsed < value.min) value.min = elapsed;
        if (elapsed > value.max) value.max = elapsed;

        const slidingValue = this.slidingCurrent.values[field];
        slidingValue.sum += elapsed;
        if (elapsed < slidingValue.min) slidingValue.min = elapsed;
        if (elapsed > slidingValue.max) slidingValue.max = elapsed;

        this.pn_values = performance.now();
    }

    start() {
        this.pn = performance.now();
        this.pn_values = performance.now();
        this.started = this.started ?? this.pn;
        if (this.slidingOld.started + WorldTickStat.SLIDING_WINDOW < this.pn) {
            this._moveSlidingWindow();
        }
    }

    end() {
        if (this.pn !== null) {
            // Calculate stats of elapsed time for ticks
            this.last = performance.now() - this.pn;

            this.#history[this.#index++ % this.#history.length] = this.last;
            this.tps = Math.min(
                1000 /
                    (this.#history.reduce((a, b) => a + b) /
                        this.#history.length),
                20,
            );

            this.total += this.last;
            this.count++;
            for (const value of this.valuesArray) {
                value.avg = value.sum / this.count;
            }
            if (this.last < this.min) this.min = this.last;
            if (this.last > this.max) this.max = this.last;

            this.slidingCurrent.count++;
        }
    }

    toTable(recent = false) {
        const displayNames = {};
        const tableValues = {};
        const valueLens = {};
        let row;

        const that = this;
        function addValue(colName, value) {
            const decimals =
                that.decimals[colName] ?? that.decimals.default ?? 2;
            value =
                value !== Infinity && value !== -Infinity
                    ? value.toFixed(decimals)
                    : '';
            row[colName] = value;
            displayNames[colName] = colName;
            valueLens[colName] = Math.max(
                valueLens[colName] ?? 0,
                value.length,
            );
        }

        for (let [rowName, rowStats] of Object.entries(this.values)) {
            row = {};
            let started, sum;
            if (recent) {
                started = this.slidingOld.started;
                const values0 = this.slidingOld.values[rowName];
                const values1 = this.slidingCurrent.values[rowName];
                addValue('min', Math.min(values0.min, values1.min));
                addValue('max', Math.max(values0.max, values1.max));
                const count = this.slidingOld.count + this.slidingCurrent.count;
                sum = values0.sum + values1.sum;
                addValue('avg', count ? sum / count : 0);
            } else {
                started = this.started;
                sum = rowStats.sum;
                for (let [colName, value] of Object.entries(rowStats)) {
                    addValue(colName, value);
                }
            }
            const seconds = (performance.now() - started) * 0.001;
            if (seconds) {
                addValue('ms/sec', sum / seconds);
            }
            tableValues[rowName] = row;
        }

        const table = {};
        for (let [rowName, rowStats] of Object.entries(tableValues)) {
            let temp = [];
            for (let [colName, value] of Object.entries(rowStats)) {
                temp.push(colName + ': ' + value.padStart(valueLens[colName]));
            }
            table[rowName] = temp.join('; ');
        }
        return table;
    }

    _createValue() {
        return { min: Infinity, max: -Infinity, avg: 0, sum: 0 };
    }

    _createSlidingValue() {
        return { min: Infinity, max: -Infinity, sum: 0 };
    }

    _moveSlidingWindow() {
        this.slidingOld = this.slidingCurrent;
        this.slidingCurrent = {
            values: ArrayHelpers.toObject(
                this.stat_names,
                (i, name) => name,
                this._createSlidingValue,
            ),
            count: 0,
            started: performance.now(),
        };
    }
}
