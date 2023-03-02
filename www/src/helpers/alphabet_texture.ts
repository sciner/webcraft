import {default as runes} from "../../vendors/runes.js";

export class RuneStrings {
    [key: string]: any;

    static toArray(str : string) {
        return runes(str);
    }

    // Разделяет слово на строки, в которых максимум указанное в [chunk] количество букв (с учётом emoji)
    static toChunks(str : string, chunk : int) : string[] {
        const rs = runes(str);
        if(rs.length > chunk) {
            let i : int, j : int, resp = [];
            for (i = 0, j = rs.length; i < j; i += chunk) {
                resp.push(rs.slice(i, i + chunk).join(''));
            }
            return resp;
        }
        return [str];
    }

    // Разделяет длинные слова пробелами (с учётом emoji)
    static splitLongWords(str : string, max_len : int) {
        let text = str.replaceAll("\r", "¡");
        let temp = text.split(' ');
        for(let i = 0; i < temp.length; i++) {
            let word = temp[i];
            if(word) {
                temp[i] = RuneStrings.toChunks(word, max_len).join(' ');
            }
        }
        return temp.join(' ').replaceAll("¡", "\r");
    }

}

export class AlphabetTexture {
    [key: string]: any;

    static width            = 1024;
    static height           = 1024;
    static char_size        = {width: 32, height: 32};
    static char_size_norm   = {width: this.char_size.width / this.width, height: this.char_size.height / this.height};
    static chars            = new Map();
    static chars_x: any;

    // init...
    static init() {
        if(this.chars_x) {
            return false;
        }
        this.chars_x = Math.floor(this.width / this.char_size.width);

        // {
        //    "id":9608,
        //    "index":1283,
        //    "char":"█",
        //    "width":25,
        //    "height":46,
        //    "xoffset":-2,
        //    "yoffset":-4,
        //    "xadvance":21,
        //    "chnl":15,
        //    "x":0,
        //    "y":0,
        //    "page":0
        // }
        const uvs = globalThis.alphabet.msdf;
        const sprite_size = uvs.common.scaleW;
        for(let uv of uvs.chars) {
            const char = uv.char;
            const shift_x = 0; // (uv.originX / uv.height);
            const shift_y = 0; // (uv.height - uv.originY) / uv.height;
            let pos = {
                uv,
                xn: uv.x / sprite_size,
                yn: uv.y / sprite_size,
                width: uv.width / sprite_size,
                height: uv.height / sprite_size,
                shift_x: shift_x,
                shift_y: shift_y,
                char
            };
            this.chars.set(char, pos);
        }

        /*
        const uvs = globalThis.alphabet.sdf;
        const sprite_size = uvs.width;
        for(let char in uvs.characters) {
            const uv = uvs.characters[char] || uvs.characters["�"];
            const shift_x = 0;
            const shift_y = (uv.height - uv.originY) / uv.height;
            let pos = {
                uv,
                xn: uv.x / sprite_size,
                yn: uv.y / sprite_size,
                width: uv.width / sprite_size,
                height: uv.height / sprite_size,
                shift_x: shift_x,
                shift_y: shift_y,
                char
            };
            this.chars.set(char, pos);
        }
        */

    }

    // getStringUVs...
    static getStringUVs(str : string) {
        AlphabetTexture.init();
        const chars = RuneStrings.toArray(str);
        const resp = [];
        const def_char = this.chars.get('�');
        for(let char of chars) {
            const item = this.chars.has(char) ? this.chars.get(char) : def_char;
            if(char == "\r") {
                item.char = char;
            }
            resp.push(item);
        }
        return resp;
    }

}
