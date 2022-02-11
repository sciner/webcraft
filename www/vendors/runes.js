'use strict';
let exports={};
//Object.defineProperty(exports, "__esModule", { value: true });
exports.substr = exports.substring = exports.betweenInclusive = exports.codePointFromSurrogatePair = exports.isZeroWidthJoiner = exports.isGraphem = exports.isDiacriticalMark = exports.isVariationSelector = exports.isFitzpatrickModifier = exports.isRegionalIndicator = exports.isFirstOfSurrogatePair = exports.nextUnits = exports.runes = exports.GRAPHEMS = exports.ZWJ = exports.DIACRITICAL_MARKS_END = exports.DIACRITICAL_MARKS_START = exports.VARIATION_MODIFIER_END = exports.VARIATION_MODIFIER_START = exports.FITZPATRICK_MODIFIER_END = exports.FITZPATRICK_MODIFIER_START = exports.REGIONAL_INDICATOR_END = exports.REGIONAL_INDICATOR_START = exports.LOW_SURROGATE_START = exports.HIGH_SURROGATE_END = exports.HIGH_SURROGATE_START = void 0;
exports.HIGH_SURROGATE_START = 0xd800;
exports.HIGH_SURROGATE_END = 0xdbff;
exports.LOW_SURROGATE_START = 0xdc00;
exports.REGIONAL_INDICATOR_START = 0x1f1e6;
exports.REGIONAL_INDICATOR_END = 0x1f1ff;
exports.FITZPATRICK_MODIFIER_START = 0x1f3fb;
exports.FITZPATRICK_MODIFIER_END = 0x1f3ff;
exports.VARIATION_MODIFIER_START = 0xfe00;
exports.VARIATION_MODIFIER_END = 0xfe0f;
exports.DIACRITICAL_MARKS_START = 0x20d0;
exports.DIACRITICAL_MARKS_END = 0x20ff;
exports.ZWJ = 0x200d;
exports.GRAPHEMS = [
    0x0308,
    0x0937,
    0x0937,
    0x093F,
    0x093F,
    0x0BA8,
    0x0BBF,
    0x0BCD,
    0x0E31,
    0x0E33,
    0x0E40,
    0x0E49,
    0x1100,
    0x1161,
    0x11A8, // ( ᆨ ) HANGUL JONGSEONG KIYEOK
];
function runes(string) {
    if (typeof string !== 'string') {
        throw new Error('string cannot be undefined or null');
    }
    const result = [];
    let i = 0;
    let increment = 0;
    while (i < string.length) {
        increment += nextUnits(i + increment, string);
        if (isGraphem(string[i + increment])) {
            increment++;
        }
        if (isVariationSelector(string[i + increment])) {
            increment++;
        }
        if (isDiacriticalMark(string[i + increment])) {
            increment++;
        }
        if (isZeroWidthJoiner(string[i + increment])) {
            increment++;
            continue;
        }
        result.push(string.substring(i, i + increment));
        i += increment;
        increment = 0;
    }
    return result;
}
exports.runes = runes;
// Decide how many code units make up the current character.
// BMP characters: 1 code unit
// Non-BMP characters (represented by surrogate pairs): 2 code units
// Emoji with skin-tone modifiers: 4 code units (2 code points)
// Country flags: 4 code units (2 code points)
// Variations: 2 code units
function nextUnits(i, string) {
    const current = string[i];
    // If we don't have a value that is part of a surrogate pair, or we're at
    // the end, only take the value at i
    if (!isFirstOfSurrogatePair(current) || i === string.length - 1) {
        return 1;
    }
    const currentPair = current + string[i + 1];
    let nextPair = string.substring(i + 2, i + 5);
    // Country flags are comprised of two regional indicator symbols,
    // each represented by a surrogate pair.
    // See http://emojipedia.org/flags/
    // If both pairs are regional indicator symbols, take 4
    if (isRegionalIndicator(currentPair) && isRegionalIndicator(nextPair)) {
        return 4;
    }
    // If the next pair make a Fitzpatrick skin tone
    // modifier, take 4
    // See http://emojipedia.org/modifiers/
    // Technically, only some code points are meant to be
    // combined with the skin tone modifiers. This function
    // does not check the current pair to see if it is
    // one of them.
    if (isFitzpatrickModifier(nextPair)) {
        return 4;
    }
    return 2;
}
exports.nextUnits = nextUnits;
function isFirstOfSurrogatePair(string) {
    return string && betweenInclusive(string[0].charCodeAt(0), exports.HIGH_SURROGATE_START, exports.HIGH_SURROGATE_END);
}
exports.isFirstOfSurrogatePair = isFirstOfSurrogatePair;
function isRegionalIndicator(string) {
    return betweenInclusive(codePointFromSurrogatePair(string), exports.REGIONAL_INDICATOR_START, exports.REGIONAL_INDICATOR_END);
}
exports.isRegionalIndicator = isRegionalIndicator;
function isFitzpatrickModifier(string) {
    return betweenInclusive(codePointFromSurrogatePair(string), exports.FITZPATRICK_MODIFIER_START, exports.FITZPATRICK_MODIFIER_END);
}
exports.isFitzpatrickModifier = isFitzpatrickModifier;
function isVariationSelector(string) {
    return typeof string === 'string' && betweenInclusive(string.charCodeAt(0), exports.VARIATION_MODIFIER_START, exports.VARIATION_MODIFIER_END);
}
exports.isVariationSelector = isVariationSelector;
function isDiacriticalMark(string) {
    return typeof string === 'string' && betweenInclusive(string.charCodeAt(0), exports.DIACRITICAL_MARKS_START, exports.DIACRITICAL_MARKS_END);
}
exports.isDiacriticalMark = isDiacriticalMark;
function isGraphem(string) {
    return typeof string === 'string' && exports.GRAPHEMS.indexOf(string.charCodeAt(0)) !== -1;
}
exports.isGraphem = isGraphem;
function isZeroWidthJoiner(string) {
    return typeof string === 'string' && string.charCodeAt(0) === exports.ZWJ;
}
exports.isZeroWidthJoiner = isZeroWidthJoiner;
function codePointFromSurrogatePair(pair) {
    const highOffset = pair.charCodeAt(0) - exports.HIGH_SURROGATE_START;
    const lowOffset = pair.charCodeAt(1) - exports.LOW_SURROGATE_START;
    return (highOffset << 10) + lowOffset + 0x10000;
}
exports.codePointFromSurrogatePair = codePointFromSurrogatePair;
function betweenInclusive(value, lower, upper) {
    return value >= lower && value <= upper;
}
exports.betweenInclusive = betweenInclusive;
function substring(string, start, width) {
    const chars = runes(string);
    if (start === undefined) {
        return string;
    }
    if (start >= chars.length) {
        return '';
    }
    const rest = chars.length - start;
    const stringWidth = width === undefined ? rest : width;
    let endIndex = start + stringWidth;
    if (endIndex > (start + rest)) {
        endIndex = undefined;
    }
    return chars.slice(start, endIndex).join('');
}
exports.substring = substring;
exports.substr = substring;
runes.substr = substring;
runes.substring = substring;
runes.default = runes;
runes.runes = runes;
Object.defineProperty(runes, "__esModule", { value: true });
export default runes;