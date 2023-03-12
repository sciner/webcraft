"use strict";

import {Mth, Vector} from "./helpers.js";

const BINARY_ALPHABET = `0123456789abcdefghjiklmnopqrstuvwxyzABCDEFGHJIKLMNOPQRSTUVWXYZ!#$%^&*()[]{}_+-=<>~':;?`.split('');
const FLAGS_TO_MODIFY_CHAR = ['', '@', '.', ',']; // the index = flags;
const MODIFY_CHAR_TO_FLAGS = {'@': 1, '.': 2, ',': 3};

const TMP_BOOLEAN_ARRAY: boolean[] = []
const TMP_INT_ARRAY: int[] = []
const BITS_PER_ELEMENT = 31 // not 32, because we don't want 32nd bit to serialized as sign

export const NEARBY_FLAGS = {
    HAS_MODIFIERS:  0x1,
    HAS_OTHER_DATA: 0x2
}

// 71374 -> 15131 -> 12269 -> 10962 -> 9653 -> 3979
export function compressNearby(nearby, use_start_vec = true) {

    //
    const mid = Math.floor(BINARY_ALPHABET.length / 2);
    const nb = [];
    const start_vec = new Vector(0, 0, 0);
    var end_vec = start_vec; // used for deleted; if end_vec === start_vec, it's not saved
    const _temp_vec = new Vector(0, 0, 0);
    if(nearby.added.length) {
        start_vec.copyFrom(nearby.added[0].addr);
        // a big distance between start_vec and end_vec is possible when teleporting
        if (nearby.deleted.length && nearby.deleted[0].distanceSqr(nearby.added[0].addr) > 3) {
            end_vec = new Vector(0, 0, 0);
            end_vec.copyFrom(nearby.deleted[0]);
        }
    } else if (nearby.deleted.length) {
        start_vec.copyFrom(nearby.deleted[0]);
    }
    //
    nb.push(nearby.chunk_render_dist);
    if (use_start_vec) {
        nb.push(start_vec.toHash());
        nb.push(end_vec !== start_vec ? end_vec.toHash() : '');
    } else {
        nb.push('');
    }
    const getSymbol = (num) => {
        return BINARY_ALPHABET[mid + num];
    };
    // added
    let aa = '';
    for(let i = 0; i < nearby.added.length; i++) {
        const item = nearby.added[i];
        if(use_start_vec) {
            _temp_vec.copyFrom(item.addr).subSelf(start_vec);
            let m = FLAGS_TO_MODIFY_CHAR[item.flags];
            m += getSymbol(_temp_vec.x) + getSymbol(_temp_vec.y) + getSymbol(_temp_vec.z);
            if(m.length > 4) {
                return compressNearby(nearby, false);
            }
            aa += m;
        } else {
            let m = FLAGS_TO_MODIFY_CHAR[item.flags];
            aa += m + item.addr.toHash() + '_';
        }
    }
    nb.push(aa);
    // deleted
    let dd = '';
    for(let i = 0; i < nearby.deleted.length; i++) {
        const addr = nearby.deleted[i];
        if(use_start_vec) {
            _temp_vec.copyFrom(addr).subSelf(end_vec);
            const m = getSymbol(_temp_vec.x) + getSymbol(_temp_vec.y) + getSymbol(_temp_vec.z);
            if(m.length > 4) {
                return compressNearby(nearby, false);
            }
            dd += m;
        } else {
            dd += addr.toHash() + '_';
        }
    }
    nb.push(dd);
    const resp = nb.join('|');
    const v1 = JSON.stringify(nearby, null, 2);
    const v2 = JSON.stringify(decompressNearby(resp), null, 2);
    if(v1 != v2) {
        throw 'invalid_nearby';
    }
    return resp;
}

//
export function decompressNearby(str) {
    const mid = Math.floor(BINARY_ALPHABET.length / 2);
    const arr = str.split('|');
    const nearby = {
        chunk_render_dist: parseInt(arr.shift()),
        added: [],
        deleted: []
    };
    // start_vec
    const star_vec_string = arr.shift();
    const use_start_vec = star_vec_string.length > 0;
    const start_vec = new Vector(0, 0, 0);
    var end_vec = start_vec;
    if(use_start_vec) {
        start_vec.set(...star_vec_string.split(',').map((x : string) => parseInt(x)) as [number, number, number]);
        // end vec
        const end_vec_string = arr.shift();
        if(end_vec_string.length > 0) {
            end_vec = new Vector(end_vec_string.split(',').map((x : string) => parseInt(x)) as [number, number, number]);
        }
    }
    // added
    let added = arr.shift();
    if(use_start_vec) {
        added = added.split('');
        for(let i = 0; i < added.length; i += 3) {
            const flags = MODIFY_CHAR_TO_FLAGS[added[i]] ?? 0;
            if(flags) i++;
            let x = BINARY_ALPHABET.indexOf(added[i + 0]) - mid;
            let y = BINARY_ALPHABET.indexOf(added[i + 1]) - mid;
            let z = BINARY_ALPHABET.indexOf(added[i + 2]) - mid;
            const addr = new Vector(x, y, z).addSelf(start_vec);
            nearby.added.push({addr, flags})
        }
    } else {
        added = added.split('_');
        for(let i = 0; i < added.length - 1; i++) {
            let temp = added[i];
            const flags = MODIFY_CHAR_TO_FLAGS[temp[0]] ?? 0;
            if(flags) {
                temp = temp.substring(1);
            }
            const addr = new Vector(temp.split(',').map((x : string) => parseInt(x)) as [number, number, number]);
            nearby.added.push({addr, flags})
        }
    }
    // deleted
    let deleted = arr.shift();
    if(use_start_vec) {
        deleted = deleted.split('');
        for(let i = 0; i < deleted.length; i += 3) {
            let x = BINARY_ALPHABET.indexOf(deleted[i + 0]) - mid;
            let y = BINARY_ALPHABET.indexOf(deleted[i + 1]) - mid;
            let z = BINARY_ALPHABET.indexOf(deleted[i + 2]) - mid;
            const addr = new Vector(x, y, z).addSelf(end_vec);
            nearby.deleted.push(addr)
        }
    } else {
        deleted = deleted.split('_');
        for(let i = 0; i < deleted.length - 1; i++) {
            const temp = deleted[i];
            const addr = new Vector(temp.split(',').map((x : string) => parseInt(x)) as [number, number, number]);
            nearby.deleted.push(addr)
        }
    }
    return nearby;
}


/** Packs up to 32 boolean values as bits into a single int value. */
export function packBooleans(...values: boolean[]): int {
    if (values.length > 32) {
        throw new Error()
    }
    let res = 0 | 0
    let flag = 1
    for(const v of values) {
        if (v) {
            res |= flag
        }
        flag <<= 1
    }
    return res
}

/**
 * Unpacks bits as boolean values.
 * @param flags
 * @param length - if it's specified, it returns exactly this number of boolean values.
 *   If it's not specified, it's guaranteed to return all non-zero bits as true values, but
 *   the rest may be undefined instead of false. It's slightly faster and slightly more convenient.
 *   If the reading code doesn't distinguish between false and undefined, it's preferable to not define length.
 * @return a shared instance of an array with the boolean values. Do not store reference to it!
 *   Use it only for destructing assignment like this:
 *     const [hasA, flagB, c] = unpackBooleans(intValue)
 */
export function unpackBooleans(flags: int, length?: int): boolean[] {
    const arr = TMP_BOOLEAN_ARRAY
    if (length) {
        arr.length = length
        for (let i = 0; i < length; i++) {
            arr[i] = (flags & 1) !== 0
            flags >>= 1
        }
    } else {
        let i = 0;
        while(flags) {
            arr[i] = (flags & 1) !== 0
            flags >>>= 1
            i++
        }
        arr.length = i // clear true values that may have remained in the array
    }
    return arr
}

/** A type that stores packet data used by {@link OutPacketBuffer} and {@link InPacketBuffer} */
export type PacketBuffer = any[]

/**
 * A common interface of {@link OutPacketBuffer} or {@link OutDeltaCompressor} that allows writing methods that support both.
 *
 * If necessary, add methods putIntOrNull(), putStringOrNull(), etc. that use putBoolean() to store whether the value is null.
 */
export interface IOutPacketBuffer {
    /** It's useful in {@link OutDeltaCompressor} to access the underlying buffer to write data without delta compression. */
    get buf(): OutPacketBuffer
    /** Puts the value of any type (e.g., whole objects) without validation and processing. */
    put(v: any): IOutPacketBuffer
    putInt(v: int): IOutPacketBuffer
    putFloat(v: float, decimals?: int): IOutPacketBuffer
    putString(v: string): IOutPacketBuffer
    putIntVector(v: IVector): IOutPacketBuffer
    putFloatVector(v: IVector, decimals?: int): IOutPacketBuffer
    /**
     * Writes a boolean value.
     *
     * Implementation: all booleans are packed as a bits into the special element, up to 31 bit.
     * This element allocated only when the 1st boolean is written.
     * When all bits of the element are filled, a new such element is allocated.
     *
     * Note: unlike other methods, it returns the written value, not the self reference.
     */
    putBoolean(v: boolean): boolean
}

/**
 * It reads what the corresponding implementation of {@link IOutPacketBuffer} writes.
 * It also performs basic type validation.
 */
export interface IInPacketBuffer {
    get buf(): InPacketBuffer
    get<T = any>(): T
    getInt(): int
    getFloat(): float
    getString(): string
    getIntVector(dst?: Vector): Vector
    getFloatVector(dst?: Vector): Vector
    getBoolean(): boolean
}

/** It stores data of packet that is being built, appends values to it, and exports it as {@link PacketBuffer} */
export class OutPacketBuffer implements IOutPacketBuffer {
    private data: PacketBuffer = []

    /**
     * The last index of the element reserved for bits. -1 means the element doesn't exist.
     * @see putBoolean for the general explanation of this feature.
     */
    private bitsIndex = -1
    /** Accumulated bits that will be stored in by the address {@link bitsIndex} */
    private bitsValue: int
    /**
     * The number of bits written to {@link bitsValue}. The number of remaining free bits is (BITS_PER_ELEMENT - bitsCount).
     * The initial value BITS_PER_ELEMENT means "there are no free bits", so the first written bit causes a data element
     * to be allocated.
     */
    private bitsCount = BITS_PER_ELEMENT

    get buf() { return this }

    /** Returns the current packet data. Resets the buffer, so it can build a new packet. */
    exportAndReset(): PacketBuffer {
        const data = this.data
        // flush the remaining bits
        if (this.bitsIndex >= 0) {
            data[this.bitsIndex] = this.bitsValue
            this.bitsIndex = -1
            this.bitsCount = BITS_PER_ELEMENT
        }
        this.data = [] // clear the buffer for the next use
        return data
    }

    get length() { return this.data.length }

    put(v: any): this {
        this.data.push(v)
        return this
    }

    putInt(v: int): this {
        if ((v | 0) !== v) {
            throw `incorrect int ${v}`
        }
        this.data.push(v)
        return this
    }

    putFloat(v: float, decimals?: int): this {
        if (decimals != null) {
            v = Mth.round(v, decimals)
        }
        this.data.push(v)
        return this
    }

    putString(v: string): this {
        if (typeof v !== 'string') {
            throw `incorrect string ${v}`
        }
        this.data.push(v)
        return this
    }

    putIntVector(v: IVector): this {
        this.data.push(v.x, v.y, v.z)
        return this
    }

    putFloatVector(v: IVector, decimals?: int): this {
        this.putFloat(v.x, decimals)
        this.putFloat(v.y, decimals)
        this.putFloat(v.z, decimals)
        return this
    }

    /** @see IOutPacketBuffer.putBoolean */
    putBoolean(v: boolean): boolean {
        let bitsCount = this.bitsCount
        if (bitsCount === BITS_PER_ELEMENT) {
            if (this.bitsIndex >= 0) {
                this.data[this.bitsIndex] = this.bitsValue
            }
            this.bitsIndex = this.data.length - 1
            this.data.push(0)
            bitsCount = this.bitsCount = 0
            this.bitsValue = 0 | 0
        }
        if (v) {
            this.bitsValue |= 1 << bitsCount
        }
        this.bitsCount = bitsCount + 1
        return v
    }
}

/** It reads what {@link OutPacketBuffer} writes. */
export class InPacketBuffer implements IInPacketBuffer {
    private data: PacketBuffer

    // Al booleans (bits) Similar semantics as in OutPacketBuffer
    private index: int
    private bitsValue: int
    private bitsCount: int

    get buf() { return this }

    import(data: PacketBuffer): this {
        this.data = data
        this.index = 0
        this.bitsCount = 0
        return this
    }

    get remaining(): int { return this.data.length - this.index }

    get<T = any>(): T {
        this.checkRemaining()
        return this.data[this.index++]
    }

    getInt(): int {
        const v = this.data[this.index++]
        if ((v | 0) !== v) {
            this._checkUnderflow()
            throw `incorrect int ${v}`
        }
        return v
    }

    getFloat(): float {
        const v = this.data[this.index++]
        if (typeof v !== 'number') {
            this._checkUnderflow()
            throw `incorrect float ${v}`
        }
        return v
    }

    getString(): string {
        const v = this.data[this.index++]
        if (typeof v !== 'string') {
            this._checkUnderflow()
            throw `incorrect string ${v}`
        }
        return v
    }

    getIntVector(dst = new Vector()): Vector {
        dst.x = this.getInt()
        dst.y = this.getInt()
        dst.z = this.getInt()
        return dst
    }

    getFloatVector(dst = new Vector()): Vector {
        dst.x = this.getFloat()
        dst.y = this.getFloat()
        dst.z = this.getFloat()
        return dst
    }

    getBoolean(): boolean {
        let bitsCount = this.bitsCount
        let bitsValue = this.bitsValue
        if (bitsCount === 0) {
            this.checkRemaining()
            bitsCount = this.bitsCount = BITS_PER_ELEMENT
            bitsValue = this.bitsValue = this.data[this.index++] | 0
        }
        const res = (bitsValue & 1) !== 0 // the performance penalty of converting to boolean is negligible
        this.bitsValue = bitsValue >>> 1
        this.bitsCount = bitsCount - 1
        return res
    }

    static checkMinMax(v: number, min: number, max: number = Infinity) {
        if (v < min || v > max) {
            throw `value ${v} is out of range ${min} ${max}`
        }
    }

    checkRemaining(length: int = 1): void {
        const remaining = this.data.length - this.index
        if (length > remaining) {
            throw `trying to read ${length} elements, but have only ${remaining}`
        }
    }

    private _checkUnderflow(): void {
        if (this.index >= this.data.length) {
            throw 'buffer underflow'
        }
    }
}

abstract class AbstractDeltaCompressor {
    protected hash: int // the current value of hash. It's used for debug purposes
    protected useHash: boolean // a switch - whether to write the hash into the packets. Enable it for debugging, disable in production

    protected prevValuesBySequenceId: { [sequenceId: string | number | null]: any[] } = {} // all sequences
    protected prevValues: any[] // the current sequence
    protected prevValuesIndex: int // the index in the crrent sequence

    constructor(useHash = true) {
        this.useHash = useHash
    }

    /** Starts reading/writing a sequence of values from the beginning of that sequence. */
    startSequence(sequenceId: string | int | null): this {
        this.prevValues = this.prevValuesBySequenceId[sequenceId] ?? (this.prevValuesBySequenceId[sequenceId] = [])
        this.prevValuesIndex = 0
        return this
    }
}

/**
 * It wraps around {@link OutPacketBuffer} and provides delta compression.
 * 
 * It stores previously written values. After a value was written once, only delta is written for this value.
 * For numeric fields, if the delta is 0, it results in "0," in the stringified resulting array,
 * which is compressed efficiently.
 * 
 * The values are distinguished by the order in which they are written.
 * Several independent sequences of values are supported. Sequences have numeric or string ids.
 * A buffer can start a new sequence at any time.
 *
 * To avoid data corruption, all the values written by this class must be read by {@link InDeltaCompressor}
 * in the same order. No packets can be skipped.
 * Generally, it means that if some packet hasn't benn read completely (e.g. due to an exception), future packets
 * can't be read correctly, and the connection must be reset.
 *
 * Values can can be written/read without delta compression using the underlying {@link buf}.
 */
export class OutDeltaCompressor extends AbstractDeltaCompressor implements IOutPacketBuffer {
    buf: OutPacketBuffer

    start(buf: OutPacketBuffer, sequenceId: string | int | null = null): this {
        this.buf = buf
        this.hash = 0
        return this.startSequence(sequenceId)
    }

    /** Puts the value of any type without validation and processing. */
    put(v: any): this {
        this.buf.put(v)
        return this
    }

    putInt(v: int): this {
        this.hash = (this.hash << 5) - this.hash + v | 0
        const ind = this.prevValuesIndex++
        this.buf.putInt(v - (this.prevValues[ind] ?? 0))
        this.prevValues[ind] = v
        return this
    }

    putFloat(v: float, decimals?: int): this {
        const ind = this.prevValuesIndex++
        const prev = this.prevValues[ind] ?? 0
        let delta = v - prev

        if (decimals != null) {
            delta = Mth.round(delta, decimals) // round the actual value bing written, not the source
        }
        v = prev + delta    // get the exact same value as InDeltaCompressor would get, including rounding errors

        this.hash = (this.hash << 5) - this.hash + Mth.intHash(v) | 0
        this.buf.put(delta)
        this.prevValues[ind] = v
        return this
    }

    putString(v: string): this {
        this.hash = (this.hash << 5) - this.hash + v.length | 0 // it's compromised for speed: only use the length
        const ind = this.prevValuesIndex++
        if (this.buf.putBoolean((this.prevValues[ind] ?? '') !== v)) {
            this.buf.putString(v)
        }
        this.prevValues[ind] = v
        return this
    }

    putIntVector(v: IVector): this {
        this.putInt(v.x)
        this.putInt(v.y)
        this.putInt(v.z)
        return this
    }

    putFloatVector(v: IVector, decimals?: int): this {
        this.putFloat(v.x, decimals)
        this.putFloat(v.y, decimals)
        this.putFloat(v.z, decimals)
        return this
    }

    putBoolean(v: boolean) { return this.buf.putBoolean(v) }

    /**
     * It writes a hash of previously written values. It's to detect data corruption due to bugs.
     * The hash is far from perfect (a compromise for speed and code size), but it does its job.
     */
    putHash(): this {
        // write 31 bit of the hash to avoid stringifying the sign, which takes half a character on average
        if (this.useHash) {
            this.buf.put(this.hash & 0x7FFFFFFF)
        }
        return this
    }
}

/** It reads what {@link OutDeltaCompressor} writes. */
export class InDeltaCompressor extends AbstractDeltaCompressor implements IInPacketBuffer {
    buf: InPacketBuffer

    start(buf: InPacketBuffer, sequenceId: string | int | null = null): this {
        this.buf = buf
        this.hash = 0
        return this.startSequence(sequenceId)
    }

    get<T = any>(): T { return this.buf.get<T>() }

    getInt(): int {
        const ind = this.prevValuesIndex++
        const v = this.buf.getInt() + (this.prevValues[ind] ?? 0)
        this.hash = (this.hash << 5) - this.hash + v | 0
        return this.prevValues[ind] = v
    }

    getFloat(): float {
        const ind = this.prevValuesIndex++
        const v = this.buf.getFloat() + (this.prevValues[ind] ?? 0)
        this.hash = (this.hash << 5) - this.hash + Mth.intHash(v) | 0
        return this.prevValues[ind] = v
    }

    getString(): string {
        const ind = this.prevValuesIndex++
        const v = this.buf.getBoolean() ? this.buf.getString() : (this.prevValues[ind] ?? '')
        this.hash = (this.hash << 5) - this.hash + v.length | 0 // it's compromised: only use length for speed
        return this.prevValues[ind] = v
    }

    getIntVector(v: Vector = new Vector()): Vector {
        v.x = this.getInt()
        v.y = this.getInt()
        v.z = this.getInt()
        return v
    }

    getFloatVector(v: Vector = new Vector()): Vector {
        v.x = this.getFloat()
        v.y = this.getFloat()
        v.z = this.getFloat()
        return v
    }

    getBoolean(): boolean { return this.buf.getBoolean() }

    /**
     * Reads the hash written by {@link OutDeltaCompressor.putHash}, compares it to the locally calculated hash,
     * and throws an exception they don't match.
     */
    checkHash() {
        if (this.useHash && (this.hash & 0x7FFFFFFF) !== this.buf.get()) {
            throw `incorrect delta compressor hash`
        }
    }
}