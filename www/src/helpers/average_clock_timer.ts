// AverageClockTimer
export class AverageClockTimer {
    [key: string]: any;
    sum: number;
    history_index: number;
    history: number[];
    prev: number | null;
    min: number | null;
    max: number | null;
    avg: number | null;

    constructor() {
        this.prev       = null,
            this.min        = null,
            this.max        = null,
            this.avg        = null,
            this.sum        = 0,
            this.history_index = 0;
        this.history    = new Array(60).fill(0);
    }

    /**
     * @param value : float
     */
    add(value: number) {
        this.prev = value;
        if(this.min === null || this.min > value) {
            this.min = value;
        }
        if(this.max === null || this.max < value) {
            this.max = value;
        }
        //
        this.sum += value;
        this.history_index++;
        if(this.history_index == this.history.length) {
            this.history_index = 0;
        }
        this.sum -= this.history[this.history_index];
        this.history[this.history_index] = value;
        this.avg = (this.sum / this.history.length) || 0;
    }

}
