export class StringHelpers {
    [key: string]: any;

    // Like String.split, but splits only on the 1st separator, i.e. maximum in 2 parts.
    static splitFirst(str, separatpr) {
        const ind = str.indexOf(separatpr);
        return ind >= 0
            ? [str.substring(0, ind), str.substring(ind + 1, str.length)]
            : [str];
    }

    // The same hash as used in Java: https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
    static hash(str : string) : number {
        var hash = 0, i : int, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr | 0;
        }
        return hash;
    }

    // indexTrim
    static trim(str : string, ch : string) : string {
        var start = 0,
            end = str.length;
        while(start < end && str[start] === ch)
            ++start;
        while(end > start && str[end - 1] === ch)
            --end;
        return (start > 0 || end < str.length) ? str.substring(start, end) : str;
    }

    // converts to Roman number, from https://stackoverflow.com/questions/9083037/convert-a-number-into-a-roman-numeral-in-javascript
    static romanize(num : number) {
        let lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1}, roman = '', i;
        for (i in lookup) {
            while (num >= lookup[i]) {
                roman += i;
                num -= lookup[i];
            }
        }
        return roman;
    }

    static replaceCharAt(str : string, index : int, replacement : string) : string {
        return str.charAt(index) !== replacement
            ? str.substring(0, index) + replacement + str.substring(index + replacement.length)
            : str;
    }

    static count(str : string, subStr : string) {
        let res = 0;
        let ind = str.indexOf(subStr);
        while (ind >= 0) {
            res++;
            ind = str.indexOf(subStr, ind + 1);
        }
        return res;
    }

    static capitalizeChatAt(str : string, index : int) : string {
        return this.replaceCharAt(str, index, str.charAt(index).toUpperCase());
    }

    static capitalizeFirstLetterOfEachWord(str) {
        const re = /\W\w/g;
        let res = str; // because we need an immutable string
        let match;
        while (match = re.exec(str)) {
            res = this.capitalizeChatAt(res, match.index + 1);
        }
        return this.capitalizeChatAt(res, 0);
    }

    static applyMCStyles(str : string) : string {

        const styleMap = {
            '0': 'color:#000000',
            '1': 'color:#0000AA',
            '2': 'color:#00AA00',
            '3': 'color:#00AAAA',
            '4': 'color:#AA0000',
            '5': 'color:#AA00AA',
            '6': 'color:#FFAA00',
            '7': 'color:#AAAAAA',
            '8': 'color:#555555',
            '9': 'color:#5555FF',
            'a': 'color:#55FF55',
            'b': 'color:#55FFFF',
            'c': 'color:#FF5555',
            'd': 'color:#FF55FF',
            'e': 'color:#FFFF55',
            'f': 'color:#FFFFFF',
            'l': 'font-weight:bold',
            'm': 'text-decoration:line-through',
            'n': 'text-decoration:underline',
            'o': 'font-style:italic',
        }

        const code_char = '§'
        let cnt = 0
        let resp = ''
        for(let i = 0; i < str.length; i++) {
            const l = str.substring(i, i + 1)
            if(l == code_char) {
                i++
                const code = str.substring(i, i + 1)
                if(code == 'r') {
                    resp += '</span>'.repeat(cnt)
                    cnt = 0
                } else {
                    const style = styleMap[code]
                    if(style) {
                        resp += `<span style="${style}">`
                        cnt++
                    } else {
                        i--
                        resp += l
                    }
                }
            } else {
                resp += l
            }
        }
        resp += '</span>'.repeat(cnt)

        return resp
    }

    //
    static objectToASCIITable(data : {}) : string {
        const fields = {}
        const fields_arr = []
        let rows_count = 0
        for(const [_, row] of Object.entries(data)) {
            for(const [field_name, value] of Object.entries(row)) {
                let field = fields[field_name]
                if(!field) {
                    field = {len: 0, name: field_name}
                    fields[field_name] = field
                    fields_arr.push(field)
                }
                const value_string = `${value}`
                if(field.len < value_string.length) field.len = value_string.length
                if(field.len < field_name.length) field.len = field_name.length
            }
            rows_count++
        }
        //
        let table_width = 1
        // | aaa | bbb | ccc | ddd |
        for(const field of fields_arr) {
            table_width += field.len + 3
        }
        const line_first = '.' + ('—'.repeat(table_width - 2)) + '.'
        const line_last = '\'' + ('—'.repeat(table_width - 2)) + '\''
        let line_middle = '|'
            for(const field of fields_arr) {
                line_middle += '—'.repeat(field.len + 2) + '|'
            }
        const lines = []
        lines.push(line_first)
        let fields_buf = []
        function joinValue(value : string, field? : any, clear: boolean = false, right: boolean = false) {
            if(clear) {
                fields_buf = []
            }
            if(field) {
                const spaces = ' '.repeat(Math.max(field.len + 2 - value.length, 0))
                if(right) {
                    value = spaces + value
                } else {
                    value = value + spaces
                }
            }
            fields_buf.push(value)
        }
        // head
        joinValue('|', undefined, true)
        for(const field of fields_arr) {
            joinValue(` ${field.name} `, field)
            joinValue('|')
        }
        lines.push(fields_buf.join(''))
        lines.push(line_middle)
        // rows
        let index = 0
        for(const [_, row] of Object.entries(data)) {
            joinValue('|', undefined, true)
            for(const field of fields_arr) {
                const value = `${row[field.name]}`
                joinValue(` ${value} `, field, false, field.name != 'name')
                joinValue('|')    
            }
            lines.push(fields_buf.join(''))
            if(index++ < rows_count - 1) {
                lines.push(line_middle)
            }
        }
        lines.push(line_last)
        return lines.join('\n')
    }

}
