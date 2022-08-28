import { gzip, ungzip, inflate, deflate } from '../../vendors/pako.esm.mjs';

const COL_D = '|';
const ROW_D = '\t';

const VERSION_1 = '1';

/**
 * Compress chunk modifiers
 * @param {Object[]} json 
 * @param {boolean} need_to_gzip 
 * @returns 
 */
export function compressWorldModifyChunk(json, need_to_gzip) {
    let resp = [VERSION_1];
    let prev_id = null;
    let prev_index = null;
    let prev_row = null;
    for (let k in json) {
        let item = json[k];
        let id = item.id;
        let index = parseInt(k);
        if (prev_id !== null) {
            id -= prev_id;
        }
        if (prev_index !== null) {
            index -= prev_index;
        }
        let row = index + COL_D + id + COL_D;
        if (item.extra_data) {
            row += JSON.stringify(item.extra_data)
        };
        row += COL_D;
        if (item.rotate) {
            row += JSON.stringify(item.rotate)
        };
        if(row == prev_row) {
            resp.push(null);
        } else {
            resp.push(row);
        }
        prev_id = item.id;
        prev_index = parseInt(k);
        prev_row = row;
    }
    resp = resp.join(ROW_D);
    if(need_to_gzip) {
        // Calling gzip method
        resp = gzip(resp);
    }
    return resp;
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