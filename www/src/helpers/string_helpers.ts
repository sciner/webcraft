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
}
