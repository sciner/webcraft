import { Vector } from "./helpers.js";

const BINARY_ALPHABET = `0123456789abcdefghjiklmnopqrstuvwxyzABCDEFGHJIKLMNOPQRSTUVWXYZ!#$%^&*()[]{}_+-=<>~':;?`.split('');
const MODIFY_CHAR = '@';

// 71374 -> 15131 -> 12269 -> 10962 -> 9653 -> 3979
export function compressNearby(nearby, use_start_vec = true) {

    //
    const mid = Math.floor(BINARY_ALPHABET.length / 2);
    const nb = [];
    const start_vec = new Vector(0, 0, 0);
    const _temp_vec = new Vector(0, 0, 0);
    if(nearby.added.length) {
        start_vec.copyFrom(nearby.added[0].addr);
    } else {
        start_vec.copyFrom(nearby.deleted[0].addr);
    }
    //
    nb.push(nearby.chunk_render_dist);
    nb.push(use_start_vec ? start_vec.toHash() : '');
    const getSymbol = (num) => {
        return BINARY_ALPHABET[mid + num];
    };
    // added
    let aa = '';
    for(let i = 0; i < nearby.added.length; i++) {
        const item = nearby.added[i];
        if(use_start_vec) {
            _temp_vec.copyFrom(item.addr).subSelf(start_vec);
            let m = item.has_modifiers ? MODIFY_CHAR : '';
            m += getSymbol(_temp_vec.x) + getSymbol(_temp_vec.y) + getSymbol(_temp_vec.z);
            if(m.length > 4) {
                return compressNearby(nearby, false);
            }
            aa += m;
        } else {
            let m = item.has_modifiers ? MODIFY_CHAR : '';
            aa += m + item.addr.toHash() + '_';
        }
    }
    nb.push(aa);
    // deleted
    let dd = '';
    for(let i = 0; i < nearby.deleted.length; i++) {
        const addr = nearby.deleted[i];
        if(use_start_vec) {
            _temp_vec.copyFrom(addr).subSelf(start_vec);
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
    const sdfgh = arr.shift();
    const use_start_vec = sdfgh.length > 0;
    const start_vec = new Vector(0, 0, 0);
    if(use_start_vec) {
        start_vec.set(sdfgh.split(',').map(x => parseInt(x)));
    }
    // added
    let added = arr.shift();
    if(use_start_vec) {
        added = added.split('');
        for(let i = 0; i < added.length; i += 3) {
            const has_modifiers = added[i] == MODIFY_CHAR;
            if(has_modifiers) i++;
            let x = BINARY_ALPHABET.indexOf(added[i + 0]) - mid;
            let y = BINARY_ALPHABET.indexOf(added[i + 1]) - mid;
            let z = BINARY_ALPHABET.indexOf(added[i + 2]) - mid;
            const addr = new Vector(x, y, z).addSelf(start_vec);
            nearby.added.push({addr, has_modifiers})
        }
    } else {
        added = added.split('_');
        for(let i = 0; i < added.length - 1; i++) {
            let temp = added[i];
            const has_modifiers = temp[0] == MODIFY_CHAR;
            if(has_modifiers) {
                temp = temp.substring(1);
            }
            const addr = new Vector(0, 0, 0).set(temp.split(',').map(x => parseInt(x)));
            nearby.added.push({addr, has_modifiers})
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
            const addr = new Vector(x, y, z).addSelf(start_vec);
            nearby.deleted.push(addr)
        }
    } else {
        deleted = deleted.split('_');
        for(let i = 0; i < deleted.length - 1; i++) {
            const temp = deleted[i];
            const addr = new Vector(0, 0, 0).set(temp.split(',').map(x => parseInt(x)));
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
    const state = {
        sneak:  temp[0].substring(0, 1) == 's',
        pos:    new Vector(0, 0, 0).set(temp[0].substring(1).split(',').map(x => parseFloat(x))),
        rotate: new Vector(0, 0, 0).set(temp[1].split(',').map(x => parseFloat(x))),
        ping:   parseFloat(temp[2])
    }
    return state;
}