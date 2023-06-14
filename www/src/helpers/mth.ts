/**
 * Lerp any value between
 * @param {*} a
 * @param {*} b
 * @param {number} t
 * @param {*} res
 * @returns
 */
export function lerpComplex (a, b, t, res) {
    const typeA = typeof a;
    const typeB = typeof b;

    if (typeA !== typeB) {
        return res; // no emit
    }

    if (a == null || b == null) {
        return null;
    }

    if (typeA == 'boolean' || typeA === 'string') {
        return t > 0.5 ? b : a; // if < 0.5 return a, or b
    }

    if (typeA === 'number') {
        return a * (1 - t) + b * t;
    }

    if (Array.isArray(a)) {
        res = res || [];

        for (let i = 0; i < Math.min(a.length, b.length); i ++) {
            res[i] = a[i] * (1 - t) + b[i] * t;
        }

        return res;
    }

    res = res || {};

    for (const key in a) {

        res[key] = lerpComplex(
            a[key],
            b[key],
            t,
            res[key]
        );
    }

    return res;
}

export class Mth {

    static PI_MUL2  = Math.PI * 2
    static PI_DIV2  = Math.PI / 2
    static PI_INV   = 1 / Math.PI

    static POWER_OF_10 = new Float64Array(100)

    static initStatics() {
        let v = 1
        for(let i = 0; i < this.POWER_OF_10.length; i++) {
            this.POWER_OF_10[i] = v
            v *= 10
        }
    }

    /**
     * Lerp any value between
     * @param {*} a
     * @param {*} b
     * @param {number} t
     * @param {*} res
     * @returns
     */
    static lerpComplex = lerpComplex;

    static lerp(amount, value1, value2) {
        if (amount <= 0) return value1;
        if (amount >= 1) return value2;
        return value1 + (value2 - value1) * amount;
    }

    static lerpAny(x, x1, value1, x2, value2) {
        return x1 !== x2
            ? this.lerp((x - x1) / (x2 - x1), value1, value2)
            : (value1 + value2) * 0.5;
    }

    static sin(a) {
        return Math.sin(a);
    }

    static cos(a) {
        return Math.cos(a);
    }

    static clamp (value, min, max) {
        return value < min
            ? min : (
                value > max
                    ? max
                    : value
            );
    }

    static clampModule(value, maxModule) {
        return value >= maxModule
            ? maxModule
            : (value < -maxModule ? -maxModule : value)
    }

    static repeat(value, length) {
        return Mth.clamp(value - Math.floor(value / length) * length, 0.0, length);
    }

    /**
     * Compute a distance between over minimal arc
     * @param {number} current
     * @param {number} target
     * @returns {number}
     */
    static deltaAngle(current, target) {
        const delta = Mth.repeat((target - current), 360.0);

        return delta > 180
            ? delta - 360.0
            : delta;
    }

    /**
     * Lerp angle with over minimal distance
     * @param {number} a - start angle
     * @param {number} b - target angle
     * @param {number} t - lerp factor
     * @returns {number}
     */
    static lerpAngle(a, b, t) {
        let delta = Mth.repeat((b - a), 360);

        if (delta > 180)
            delta -= 360;

        return a + delta * Mth.clamp(t, 0, 1);
    }

    /**
     * Интерполирует угол в радианах.
     * Аргументы имеют тот же порядок и семантику что и в {@link lerp} (что отличается от {@link lerpAngle}).
     * @return угол от 0 (включительно) до 2*PI (не включительно)
     */
    static lerpRadians(amount: float, value0: float, value1: float): float {
        const delta = this.radians_to_minus_PI_PI_range(value1 - value0)
        const lerpDelta = this.lerp(amount, 0, delta)
        return this.radians_to_0_2PI_range(value0 + lerpDelta)
    }

    // lut is an array containing pairs (amount, vaue), ordered by amount ascending.
    static lerpLUT(amount, lut) {
        if (amount <= lut[0]) {
            return lut[1];
        }
        var i = 2;
        while (i < lut.length && amount > lut[i]) {
            i += 2;
        }
        if (i === lut.length) {
            return lut[i - 1];
        }
        amount = (amount - lut[i - 2]) / (lut[i] - lut[i - 2]);
        return Mth.lerp(amount, lut[i - 1], lut[i + 1]);
    }

    /** Добавляет/вычитает период 2*PI нужное число раз, делая угол от 0 (включительно) до 2*PI (не включительно) */
    static radians_to_0_2PI_range(radians: float): float {
        radians %= this.PI_MUL2
        if (radians < 0) {
            radians += this.PI_MUL2
        }
        return radians
    }

    /** Добавляет/вычитает период 2*PI нужное число раз, делая угол от -PI (включительно) до PI (не включительно) */
    static radians_to_minus_PI_PI_range(radians: float): float {
        radians %= this.PI_MUL2
        if (radians < -Math.PI) {
            radians += this.PI_MUL2
        } else if (radians >= Math.PI) {
            radians -= this.PI_MUL2
        }
        return radians
    }

    /**
     * It transforms a uniformly distributed number from in 0..1 into
     * a somewhat "normally-like" (but exactly normally) distributed
     * number ceneterd around 0.
     * @param {Number} unifirmRandom01 - a uniformly distributed random
     *  number from 0 to 1
     * @param {Number} width - the maximum absolute value of results
     * @param {Number} narrowness - the bigger the value, the narrower
     *  the distribution. From 0 to 10.
     * @param {Number} flatness - the bigger the value, the wider is the
     * distribution, but it affects the central spike more than the borders. From 0 to 1.
     *
     * {narrowness: 4, flatness: 0} and {narrowness: 8, flatness: 0.5} have similar
     * density at the border, but the 1st one has a sharper cenral skike.
     */
    static toNarrowDistribution(unifirmRandom01: number, width: number, narrowness: number, flatness: number = 0) {
        const v = (unifirmRandom01 - 0.5) * 2;
        const vToPower = Math.pow(Math.abs(v), narrowness) * v;
        return (vToPower + flatness * (v - vToPower)) * width;
    }

    // generates from min to max, inclusive
    static randomIntRange(min: number, max: number) : number {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    // generates from 0 (inclusive) to max (exclusive)
    static randomInt(maxExclusive: number) : number {
        return Math.floor(Math.random() * maxExclusive);
    }

    static round(value: number, decimals: number) : number {
        decimals = this.POWER_OF_10[decimals]
        return Math.round(value * decimals) / decimals
    }

    /** Случайно округляет вверх или вниз так, что мат. ожидание результата равно исходному числу. */
    static roundRandom(value: float): int {
        const floor = Math.floor(value)
        return Math.random() >= value - floor ? floor : floor + 1
    }

    static roundUpToPowerOfTwo(v: int): int {
        v--
        v |= v >> 1
        v |= v >> 2
        v |= v >> 4
        v |= v >> 8
        v |= v >> 16
        return v + 1
    }

    /**
     * Creates a function based on a lookup table without interpolation. Very fast and imprecise.
     * @param {number} min - the minimum value of the argument
     * @param {number} max - the maximum value of the argument
     * @param {number} size - the lookup table size. It's recommended to use at least 100.
     * @param {boolean} rangeCheck - whether to add range checks (slower, it's usefule to enable them for debugging, then turn off)
     */
    static createBasicLUTFunction(min: number, max: number, size: number = 100, rangeCheck: boolean, fn: Function): Function {
        const arr = new Float32Array(size)
        const maxInd = size - 1
        max -= min
        const kx = maxInd / max
        const kxInv = max / maxInd
        for(let i = 0; i <= maxInd; i++) {
            arr[i] = fn(min + i * kxInv)
        }
        return rangeCheck
            ? function(x: number): number {
                const ind = Math.round((x - min) * kx) | 0
                if ((ind | maxInd - ind) < 0) {
                    throw new Error()
                }
                return arr[ind]
            }
            : function(x: number): number {
                return arr[Math.round((x - min) * kx) | 0]
            }
    }

    /**
     * Similar to {@link createBasicLUTFunction}, but uses linear interpolation - more accurate and slower.
     * Chose smaller {@link size} than in {@link createBasicLUTFunction}.
     */
    static createLerpLUTFunction(min: number, max: number, size: number = 16, rangeCheck: boolean, fn: Function): Function {
        size |= 0
        // Pad with 1 element at each side, in case the argument is slightly out of bounds due to rounding errors.
        const arr = new Float64Array(size + 2)
        const maxInd = size - 1
        max -= min
        const kx = maxInd / max
        const kxInv = max / maxInd
        for(let i = 0; i <= maxInd; i++) {
            arr[i + 1] = fn(min + i * kxInv)
        }
        arr[0] = arr[1]
        arr[arr.length - 1] = arr[arr.length - 2]
        return rangeCheck
            ? function(x: number): number {
                let fi = (x - min) * kx
                const floor = Math.floor(fi)
                fi -= floor // now its semantics is "fraction beyound floor"
                const floorInd = (floor | 0) + 1
                // This condition is imprecise: it doesn't detect slight out-of-bounds.
                // But it's fast, and probably good enough to chatch bugs in practice.
                if ((floorInd | size - floorInd) < 0) {
                    throw new Error()
                }
                return arr[floorInd] * (1 - fi) + arr[floorInd + 1] * fi
            }
            : function(x: number): number {
                let fi = (x - min) * kx
                const floor = Math.floor(fi)
                fi -= floor
                const floorInd = (floor | 0) + 1
                return arr[floorInd] * (1 - fi) + arr[floorInd + 1] * fi
            }
    }

    /**
     * Produces an int32 hash from any number.
     * I doesn't distinguish NaN, Infinity, -Infinity and 0.
     * This implementation is quite bad, but it works for practical purposes.
     */
    static intHash(v: number): int {
        return v | (v - Math.floor(v)) * 1e16
    }
}

Mth.initStatics()