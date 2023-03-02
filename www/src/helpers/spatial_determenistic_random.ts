import {Vector} from "./vector.js";
import {StringHelpers} from "./string_helpers.js";

/**
 * Returns a random number based on world seed, block position, and some object.
 */
export class SpatialDeterministicRandom {
    [key: string]: any;

    /**
     * @param {Vector-like} pos
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns { int } - a signed 32-bit value based on the current world positon,
     *      world seed and spice.
     */
    static int32(world, pos : IVector, spice : number | null = null) {
        let res = Vector.toIntHash(pos.x, pos.y, pos.z) ^ world.info.seed;
        if (spice != null) {
            if (typeof spice === 'number') {
                // to account for bth integer and floating point
                spice = spice | (spice * 1000000000);
            } else if (typeof spice === 'string') {
                spice = StringHelpers.hash(spice);
            } else {
                throw Error(); // unsupported spice
            }
            res ^= (spice << 16) ^ (spice >> 16) ^ 243394093;
        }
        return res;
    }

    /**
     * Generates 31-bit unsigned int.
     * @param {Vector-like} pos
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns { int } - an unsigned 31-bit value based on the current world positon,
     *      world seed and spice.
     */
    static uint(world, pos, spice = null) {
        return SpatialDeterministicRandom.int32(world, pos, spice) & 0x7FFFFFFF;
    }

    /**
     * Generates a real number from 0 (inclisve) to 1 (exclusive).
     * @param {Vector-like} pos
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns {Float} - a value from 0 (inclusive) to 1 (exclusive), based on
     *      the current world positon, world seed and spice.
     */
    static float(world, pos, spice = null) {
        return SpatialDeterministicRandom.uint(world, pos, spice) / 0x80000000;
    }

    /**
     * Generates int number from 0 (inclusive) to max (exclusive).
     * Note: the distribution is not uniform for very large numbers.
     *
     * @param {Vector-like} pos
     * @param { int } max - the maximum value (exclusive)
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns { int } - a value from min to max, based on the current world positon,
     *      world seed and spice.
     */
    static int(world, pos, max, spice = null) {
        return SpatialDeterministicRandom.uint(world, pos, spice) % max;
    }

    /**
     * Generates int in the given range.
     * Note: the distribution is not uniform for very large numbers.
     *
     * @param {Vector-like} pos
     * @param { int } min - the minium value (inclusive)
     * @param { int } max - the maximum value (inclusive)
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns { int } - a value from min to max, based on the current world positon,
     *      world seed and spice.
     */
    static intRange(world, pos, min, max, spice = null) {
        return SpatialDeterministicRandom.uint(world, pos, spice) % (max - min + 1) + min;
    }
}
