import { gzip, ungzip, inflate, deflate } from '../../vendors/pako.esm.min.mjs';
import { BLOCK } from '../blocks.js';

const COL_D = '|';
const ROW_D = '\t';

const VERSION_1 = '1';

class CompressedModifiersBuilder {
    constructor() {
        this.resp = [VERSION_1];
        this.prev_id = null;
        this.prev_index = null;
        this.prev_row = null;
    }

    push(item, index) {
        let id = item.id;
        if (this.prev_id !== null) {
            id -= this.prev_id;
        }
        const originalIndex = index;
        if (this.prev_index !== null) {
            index -= this.prev_index;
        }
        let row = index + COL_D + id + COL_D;
        if (item.extra_data) {
            row += JSON.stringify(item.extra_data)
        };
        row += COL_D;
        if (item.rotate) {
            row += JSON.stringify(item.rotate)
        };
        if(row == this.prev_row) {
            this.resp.push(null);
        } else {
            this.resp.push(row);
        }
        this.prev_id = item.id;
        this.prev_index = originalIndex;
        this.prev_row = row;
    }

    finish(returnEmpty, need_to_gzip) {
        if (this.resp.length === 1 && !returnEmpty) {
            return null;
        }
        let resp = this.resp.join(ROW_D);
        if(need_to_gzip) {
            // Calling gzip method
            resp = gzip(resp);
        }
        return resp;
    }
}

/**
 * Compress chunk modifiers
 * @param {Object[]} json 
 * @param {boolean} need_to_gzip 
 * @returns {Object} contains 2 fields:
 *  "piblic" - compreseed modifiers that are sent to the client and contains:
 *    - normal blocks;
 *    - stripped-down versions of some special blocks, e.g. chests without slots.
 *  "private" - optional, compreseed modifiers of special blocks with full prties.
 */
export function compressWorldModifyChunk(json, need_to_gzip = true) {
    const resp          = new CompressedModifiersBuilder();
    const private_resp  = new CompressedModifiersBuilder();
    for (let k in json) {
        const item = json[k];
        const index = parseInt(k);
        const mat = BLOCK.BLOCK_BY_ID[item.id];
        if (mat?.chest?.private) {
            const slots = item.extra_data?.slots;
            if (slots) {
                // Add it to private_resp even if the slots are empty, otherwise it'd have no slots property after uncompressing.
                private_resp.push(item, index);
                // save to the public modifiers without slots.
                // Delete them even if they are empty, so the client doesn't know even that.
                delete item.extra_data.slots;
                resp.push(item, index);
                item.extra_data.slots = slots;
                continue;
            }
        }
        resp.push(item, index);
    }
    return {
        public: resp.finish(true, need_to_gzip),
        private: private_resp.finish(false, need_to_gzip)
    };
}

/**
 * If the item contains prvate fields, returns its shallow clone without such fields.
 * Otherwise returns null.
 */
export function shallowCloneAndSanitizeIfPrivate(item) {
    const mat = BLOCK.BLOCK_BY_ID[item.id];
    if (mat?.chest?.private) {
        const slots = item.extra_data?.slots;
        if (slots) {
            item = {...item};
            item.extra_data = {...item.extra_data};
            delete item.extra_data.slots;
            return item;
        }
    }
    return null;
}

/**
 * Decompress chunk modifiers
 * @param {Uint8Array} buf 
 * @returns 
 */
export function decompressWorldModifyChunk(buf) {
    const gzipped = buf[0] == 31 && buf[1] == 139;
    if(gzipped) {
        buf = ungzip(buf);
        buf = new TextDecoder().decode(buf);
    }
    const resp = {};
    buf = buf.split(ROW_D);
    let prev_row = null;
    let prev_id = null;
    let prev_index = null;
    const version = buf.shift();
    switch(version) {
        case VERSION_1: {
            for (let i = 0; i < buf.length; i++) {
                let s = buf[i];
                //
                if(s) {
                    s = s.split(COL_D);
                    prev_row = s;
                } else {
                    s = prev_row;
                }
                // index
                let index = parseInt(s[0]);
                if(prev_index !== null) index += prev_index;
                // id
                let id = parseInt(s[1]);
                if(prev_id !== null) id += prev_id;
                resp[index] = {id};
                // extra_data
                if(s[2]) {
                    resp[index].extra_data = JSON.parse(s[2]);
                }
                if(s[3]) {
                    resp[index].rotate = JSON.parse(s[3]);
                }
                prev_index = index;
                prev_id = id;
            }
            return resp;
        }
        default: {
            throw 'error_invalid_compressed_chunk_version';
        }
    }
}

/** Restores ml.obj from ml.compressed and ml.private_compressed */
export function decompressModifiresList(ml) {
    if(!ml.obj && ml.compressed) {
        ml.obj = decompressWorldModifyChunk(ml.compressed);
        if (ml.private_compressed) {
            const private_obj = decompressWorldModifyChunk(ml.private_compressed);
            Object.assign(ml.obj, private_obj);
        }
    }
}