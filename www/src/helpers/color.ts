// Color
export class Color {

    r: number;
    g: number;
    b: number;
    a: number;

    static componentToHex(c: number): string {
        const hex: string = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    static hexToColor(hex_color: string): Color {
        let c: string[];
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex_color)) {
            c = hex_color.substring(1).split('');
            if (c.length == 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            const i: number = parseInt('0x' + c.join(''));
            return new Color((i >> 16) & 255, (i >> 8) & 255, i & 255, 255); // 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+',1)';
        }
        throw new Error('Bad Hex');
    }

    constructor(r: number, g: number, b: number, a: number = 0) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    add(color: Color): Color {
        this.r += color.r;
        this.g += color.g;
        this.b += color.b;
        this.a += color.a;
        return this;
    }

    divide(color: Color): Color {
        this.r /= color.r;
        this.g /= color.g;
        this.b /= color.b;
        this.a /= color.a;
        return this;
    }

    divideScalarSelf(value : number): Color {
        this.r /= value
        this.g /= value
        this.b /= value
        this.a /= value
        return this
    }

    set(r: number | Color, g: number, b: number, a: number): Color {
        if (r instanceof Color) {
            g = r.g;
            b = r.b;
            a = r.a;
            r = r.r;
        }
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
        return this;
    }

    copyFrom(color: Color): Color {
        this.r = color.r;
        this.g = color.g;
        this.b = color.b;
        this.a = color.a;
        return this
    }

    /**
     * @return {Color}
     */
    toFloat(): Color {
        return new Color(this.r / 255, this.g / 255, this.b / 255, this.a / 255);
    }

    /**
     * @return {string}
     */
    toCSS() {
        return 'rgb(' + [this.r, this.g, this.b, this.a].join(',') + ')';
    }

    clone() {
        return new Color(this.r, this.g, this.b, this.a);
    }

    /**
     * @param {boolean} remove_alpha
     * @returns {string}
     */
    toHex(remove_alpha = false) {
        let resp = "#" + Color.componentToHex(this.r) +
            Color.componentToHex(this.g) +
            Color.componentToHex(this.b)
        if (!remove_alpha) {
            resp += Color.componentToHex(this.a)
        }
        return resp
    }

    toArray() {
        return [this.r, this.g, this.b, this.a];
    }

    equals(color) {
        return this.r === color.r && this.g === color.g && this.b === color.b && this.a === color.a;
    }
}
