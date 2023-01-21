export class WorldTickStat {

    static DEFAULT_STAT_NAMES = ['chunks', 'players', 'mobs', 'drop_items', 'packet_reader_queue',
        'maps_clear', 'packets_queue_send', 'chunks_random_tick', 'actions_queue', 'fluid_queue',
        'db_fluid_save', 'auto_spawn_hostile_mobs', 'world_transaction_sync'];

    #history = new Array(20);
    #index = 0;

    constructor(stat_names = WorldTickStat.DEFAULT_STAT_NAMES) {
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
            this.values[stat_name] = { min: Infinity, max: -Infinity, avg: 0, sum: 0 };
        }
    }

    add(field) {
        const value = this.values[field];
        if (value) {
            const elapsed = performance.now() - this.pn_values;
            value.sum += elapsed;
            if (elapsed < value.min) value.min = elapsed;
            if (elapsed > value.max) value.max = elapsed;
            value.avg = value.sum / this.count;
        } else {
            console.error('invalid tick stat value: ' + field);
        }
        this.pn_values = performance.now();
    }

    start() {
        this.pn = performance.now();
        this.pn_values = performance.now();
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
        const table = {};
        for(let [k, v] of Object.entries(this.values)) {
            let temp = [];
            for(let [vk, vv] of Object.entries(v)) {
                temp.push(vk + ': ' + Math.round(vv * 1000) / 1000);
            }
            table[k] = temp.join('; ');
        }
        return table;
    }
}