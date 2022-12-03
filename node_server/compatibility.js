
const BASE64_PADCHAR = '=';
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export class BrowserBuffer {

    constructor(uint8Array) {
        if (!uint8Array instanceof Uint8Array) {
            throw new Error('Not implemented');
        }
        this.bytes = uint8Array;
    }
    
    static from(uint8Array) {
        return new BrowserBuffer(uint8Array);
    }

    toString(encoding) {
        if (encoding !== 'base64') {
            throw new Error('Not implemented');
        }
        var b10;
        const x = [];
        const imax = this.bytes.length - this.bytes.length % 3;
        for (var i = 0; i < imax; i += 3) {
            b10 = (this.bytes[i] << 16) | (this.bytes[i + 1] << 8) | this.bytes[i + 2];
            x.push(BASE64_ALPHABET.charAt(b10 >> 18));
            x.push(BASE64_ALPHABET.charAt((b10 >> 12) & 0x3F));
            x.push(BASE64_ALPHABET.charAt((b10 >> 6) & 0x3f));
            x.push(BASE64_ALPHABET.charAt(b10 & 0x3f));
        }
        switch (this.bytes.length - imax) {
        case 1:
            b10 = this.bytes[i] << 16;
            x.push(BASE64_ALPHABET.charAt(b10 >> 18) + 
                BASE64_ALPHABET.charAt((b10 >> 12) & 0x3F) +
                BASE64_PADCHAR + BASE64_PADCHAR);
            break;
        case 2:
            b10 = (this.bytes[i] << 16) | (this.bytes[i + 1] << 8);
            x.push(BASE64_ALPHABET.charAt(b10 >> 18) + 
                BASE64_ALPHABET.charAt((b10 >> 12) & 0x3F) +
                BASE64_ALPHABET.charAt((b10 >> 6) & 0x3f) + BASE64_PADCHAR);
            break;
        }
        return x.join('');
    }
}