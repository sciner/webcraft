export class IndexedColor implements IColor {
    [key: string]: any;

    static WHITE = new IndexedColor(48, 528, 0);
    static GRASS = new IndexedColor(132, 485, 0);
    static WATER = new IndexedColor(132, 194, 0);

    r: number;
    g: number;
    b: number;
    packed: number;

    // static WHITE = null;
    // static GRASS = null;
    // static WATER = null;

    static packLm(lm) {
        return IndexedColor.packArg(lm.r, lm.g, lm.b);
    }

    static packArg(palU, palV, palMode) {
        palU = Math.round(palU);
        palV = Math.round(palV);
        return (palMode << 20) | (palV << 10) | (palU << 0);
    }

    constructor(r : int = 0, g : int = 0, b : int = 0) {
        this.r = r | 0;
        this.g = g | 0;
        this.b = b | 0;
        this.packed = IndexedColor.packArg(this.r, this.g, this.b);
    }

    set(r, g, b) {
        if(r instanceof IndexedColor) {
            g = r.g;
            b = r.b;
            r = r.r;
        }
        this.r = r;
        this.g = g;
        this.b = b;
        return this;
    }

    /**
     * only for terrain_map divide
     * @param color
     */
    divide(color : IColor) {
        this.r /= color.r;
        this.g /= color.g;
        return this;
    }

    clone() : IndexedColor {
        return new IndexedColor(this.r, this.g, this.b);
    }

    /**
     * @param {IndexedColor} ic
     */
    copyFrom(ic : IColor) {
        this.r = ic.r;
        this.g = ic.g;
        this.b = ic.b;
        return this;
    }

    flooredSelf() : IndexedColor {
        this.r = Math.floor(this.r);
        this.g = Math.floor(this.g);
        this.b = Math.floor(this.b);
        return this;
    }

    pack() {
        return this.packed = IndexedColor.packArg(this.r, this.g, this.b);
    }

}
