import { Vector } from "./helpers.js";

const BINARY_ALPHABET = `0123456789abcdefghjiklmnopqrstuvwxyzABCDEFGHJIKLMNOPQRSTUVWXYZ!#$%^&*()[]{}_+-=<>~':;?`.split('');
const FLAGS_TO_MODIFY_CHAR = ['', '@', '.', ',']; // the index = flags;
const MODIFY_CHAR_TO_FLAGS = {'@': 1, '.': 2, ',': 3};

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

// 128 -> 60
export function compressPlayerStateC(state) {
    return `${state.sneak?'s':'n'}${state.pos.toHash()}|${state.rotate.toHash()}|${state.ping}`;
}

//
export function decompressPlayerStateC(compressed_state) {
    const temp = compressed_state.split('|')
    const pos = temp[0].substring(1).split(',').map((x : string) => parseFloat(x)) as [number, number, number]
    const rotate = temp[1].split(',').map((x : string) => parseFloat(x)) as [number, number, number]
    const state = {
        sneak:  temp[0].substring(0, 1) == 's',
        pos:    new Vector(pos),
        rotate: new Vector(rotate),
        ping:   parseFloat(temp[2])
    }
    return state;
}