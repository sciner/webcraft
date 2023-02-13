import assert from 'assert';
import { ArrayHelpers } from '../../www/js/helpers.js';

function compareNumbers(a, b) {
    return a - b;
}

describe('ArrayHelpers.partialSort', function () {
    it('should sort empty array', () => {
        const arr = [];
        ArrayHelpers.partialSort(arr, arr.length, compareNumbers);
        assert.deepEqual(arr, []);
    });
    it('should sort sorted array', () => {
        const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        ArrayHelpers.partialSort(arr, arr.length, compareNumbers);
        assert.deepEqual(arr, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
    it('should sort reverse-sorted array', () => {
        const arr = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        ArrayHelpers.partialSort(arr, arr.length, compareNumbers);
        assert.deepEqual(arr, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
    it('should sort support custom comparator', () => {
        const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        ArrayHelpers.partialSort(arr, arr.length, (a, b) => b - a);
        assert.deepEqual(arr, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    });
    it('should sort array with the same values', () => {
        const arr = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        ArrayHelpers.partialSort(arr, arr.length, compareNumbers);
        assert.deepEqual(arr, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });
    it('should give the same reault as sort() for the sorted part of a random array', () => {
        for (var len = 0; len < 1000; len += 100) {
            for (var sortedLen = 0; sortedLen <= len; sortedLen += 50) {
                var arr = [];
                for (var i = 0; i < len; i++) {
                    arr.push(Math.random());
                }
                var arr2 = [...arr];
                arr.sort(compareNumbers);
                ArrayHelpers.partialSort(arr2, sortedLen, compareNumbers);
                arr.length = sortedLen;
                arr2.length = sortedLen;
                assert.deepEqual(arr, arr2);
            }
        }
    });
});
