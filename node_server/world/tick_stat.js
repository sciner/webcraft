export class WorldTickStat {

    constructor() {
        this.number = 0;
        this.pn = null;
        this.last = 0;
        this.total = 0;
        this.count = 0;
        this.min = Number.MAX_SAFE_INTEGER;
        this.max = 0;
        this.values = {
            chunks: { min: Infinity, max: -Infinity, avg: 0, sum: 0 },
            players: { min: Infinity, max: -Infinity, avg: 0, sum: 0 },
            mobs: { min: Infinity, max: -Infinity, avg: 0, sum: 0 },
            drop_items: { min: Infinity, max: -Infinity, avg: 0, sum: 0 },
            packet_reader_queue: { min: Infinity, max: -Infinity, avg: 0, sum: 0 },
            maps_clear: { min: Infinity, max: -Infinity, avg: 0, sum: 0 },
            packets_queue_send: { min: Infinity, max: -Infinity, avg: 0, sum: 0 },
            actions_queue: { min: Infinity, max: -Infinity, avg: 0, sum: 0 },
        };
    }

    start() {
        this.pn = performance.now();
        this.pn_values = performance.now();
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

    end() {
        if(this.pn !== null) {
            // Calculate stats of elapsed time for ticks
            this.last = performance.now() - this.pn;
            this.total += this.last;
            this.count++;
            if (this.last < this.min) this.min = this.last;
            if (this.last > this.max) this.max = this.last;
        }
    }

}