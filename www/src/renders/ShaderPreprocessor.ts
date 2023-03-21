const intToFloat = {
    'int': 'float',
    'ivec3': 'vec3',
}

export class ShaderPreprocessor {
    blocks: Dict<string> = {};
    global_defines: Dict<string> = {};
    fallbackProvoke = false;
    useNormalMap = false;
    constructor() {
    }

    parseBlocks(text) {
        const {blocks} = this;
        const blocksStart = '#ifdef';
        const blocksEnd = '#endif';

        let start = text.indexOf(blocksStart);
        let end = start;

        while(start > -1) {
            end = text.indexOf(blocksEnd, start);

            if (end === -1) {
                throw new TypeError('Shader block has unclosed ifdef statement at:' + start + '\n\n' + text);
            }

            const block = text.substring(start  + blocksStart.length, end);
            const lines = block.split('\n');
            const name = lines.shift().trim();

            const source = lines.map((e) => {
                return e.startsWith('    ') // remove first tab (4 space)
                    ? e.substring(4).trimEnd()
                    : e.trimEnd();
            }).join('\n');

            blocks[name] = source.trim();

            start = text.indexOf(blocksStart, start + blocksStart.length);
        }

        return blocks;
    }

    merge(preprocessor: ShaderPreprocessor) {
        Object.assign(this.blocks, preprocessor.blocks);
    }

    applyBlocks(shaderText : string, args = {}) {
        if (!shaderText) {
            return shaderText;
        }

        // remove commented lines
        shaderText = shaderText.replaceAll(/^\s*[\/\/].*$/gm, '')

        const pattern = /#include<([^>]+)>/g;

        let includesApplied = shaderText
            .replaceAll(pattern, (_, r, offset, string) => {
                return this._onReplace(r, offset, string, args || {});
            });

        // find all flats

        // check after-include process

        const postLines: Dict<string[]> = {};

        if (this.fallbackProvoke) {
            const decode = postLines['flat_decode'] = [];
            const encode = postLines['flat_encode'] = [];
            const pattern_flat = /flat (in|out) (int|ivec3|float|vec2|vec3|vec4) (\w+);/g;

            //flat out int v_flags;
            includesApplied = includesApplied.replaceAll(pattern_flat, (_, inout, type, name, offset, string) => {
                const type2 = intToFloat[type];
                const name2 = name + '_fallback';
                if (type2) {
                    if (inout === 'in') {
                        decode.push(`${name} = ${type}(round(${name2}));`);
                    } else {
                        encode.push(`${name2} = ${type2}(${name});`);
                    }
                    return `${type} ${name}; ${inout} ${type2} ${name2};`;
                } else {
                    return `${inout} ${type} ${name};`
                }
            });
        }

        const pattern_post = /#include_post<([^>]+)>/g;
        let out = includesApplied
            .replaceAll(pattern_post, (_, r, offset, string) => {
                return this._onReplace2(r, offset, string, postLines);
            });


        const defines = this.global_defines;

        for (const argkey in defines) {
            const r = new RegExp(`#define[^\\S]+(${argkey}\\s+)`, 'gmi');

            out = out.replaceAll(r, `#define ${argkey} ${defines[argkey]} //default: `);
        }

        console.debug('Preprocess result:\n', out);

        return out;
    }

    _onReplace(replace, offset, string, args = {}) {
        const {
            blocks
        } = this;

        const key = replace.trim();

        if (key.indexOf('normal_light') === 0 && !this.useNormalMap) {
            return "";
        }

        if (!(key in blocks)) {
            throw '[Preprocess] Block for ' + key + 'not found';
        }

        // compute pad spaces
        let pad = 0;
        for(pad = 0; pad < 32; pad ++) {
            if (string[offset - pad - 1] !== ' ') {
                break;
            }
        }

        let block = blocks[key]
            .split('\n')
            // we should skip first block because pad applied in repalce
            .map((e, i) => (' '.repeat(i === 0 ? 0 : pad) + e))
            .join('\n');

        const defines = args[key] || {};

        if (defines.skip) {
            return '// skip block ' + key;
        }

        for(const argkey in defines) {
            const r = new RegExp(`#define[^\\S]+(${argkey}\\s+)`, 'gmi');

            block = block.replaceAll(r, `#define ${argkey} ${defines[argkey]} // default:`);
        }

        return block;
    }

    _onReplace2(replace, offset, string, postLines) {
        const key = replace.trim();

        if (!(key in postLines)) {
            return '';
        }

        // compute pad spaces
        let pad = 0;
        for(pad = 0; pad < 32; pad ++) {
            if (string[offset - pad - 1] !== ' ') {
                break;
            }
        }

        return postLines[key]
            // we should skip first block because pad applied in repalce
            .map((e, i) => (' '.repeat(i === 0 ? 0 : pad) + e))
            .join('\n');
    }
}