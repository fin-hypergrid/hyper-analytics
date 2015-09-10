'use strict';

var timSort = require('./timsort.js');
var quickSort = require('./quicksort.js');
var stableQuickSort = require('./stableQuickSort.js');
var mergeSort = require('./mergesort.js');
var stableSort = require('./stableSort.js');

module.exports = (function() {

    var flashSort = function(indexVector, a) {
        var n = a.length;

        var i = 0,
            j = 0,
            k = 0,
            t;
        var m = ~~ (n * 0.125); /*jshint ignore:line */
        var anmin = a[indexVector[0]];
        var nmax = 0;
        var nmove = 0;

        var l = new Array(m);
        for (i = 0; i < m; i++) {
            l[i] = 0;
        }

        for (i = 1; i < n; ++i) {
            var ai = a[indexVector[i]];
            if (ai < anmin) {
                anmin = ai;
            }
            if (ai > a[indexVector[nmax]]) {
                nmax = i;
            }
        }

        var anmax = a[indexVector[nmax]];
        if (anmin === anmax) {
            return a;
        }
        var c1 = (m - 1) / (anmax - anmin);

        for (i = 0; i < n; ++i) {
            ++l[~~(c1 * (a[indexVector[i]] - anmin))]; /*jshint ignore:line */
        }

        for (k = 1; k < m; ++k) {
            l[k] += l[k - 1];
        }

        var hold = anmax;
        var hi = indexVector[nmax];
        indexVector[nmax] = indexVector[0];
        indexVector[0] = hi;

        var flash, fi;
        j = 0;
        k = m - 1;
        i = n - 1;

        while (nmove < i) {
            while (j > (l[k] - 1)) {
                k = ~~ (c1 * (a[indexVector[++j]] - anmin)); /*jshint ignore:line */
            }
            // line below added 07/03/2013, ES
            if (k < 0) {
                break;
            }

            fi = indexVector[j];
            flash = a[fi];

            while (j !== l[k]) {
                k = ~~ (c1 * (flash - anmin)); /*jshint ignore:line */
                t = --l[k];

                hold = a[indexVector[t]];
                hi = indexVector[t];
                indexVector[t] = fi;
                flash = hold;
                fi = hi;
                ++nmove;
            }
        }

        for (j = 1; j < n; ++j) {
            hold = a[indexVector[j]];
            hi = indexVector[j];
            i = j - 1;
            while (i >= 0 && a[indexVector[i]] > hold) {
                indexVector[i + 1] = indexVector[i--];
            }
            indexVector[i + 1] = hi;
        }

        return a;
    };


    //not stable
    //indexVector is an integer vector for indirection into arr
    //arr is a function that takes an index and returns the item
    var dualPivotQuickSort = function(indexVector, arr, fromIndex, toIndex) {
        if (fromIndex === undefined && toIndex === undefined) {
            dualPivotQuickSort(indexVector, arr, 0, indexVector.length);
        } else {
            rangeCheck(indexVector.length, fromIndex, toIndex);
            dpqsort(indexVector, arr, fromIndex, toIndex - 1, 3);
        }
        return arr;
    };

    function rangeCheck(length, fromIndex, toIndex) {
        if (fromIndex > toIndex) {
            console.error('fromIndex(' + fromIndex + ') > toIndex(' + toIndex + ')');
        }
        if (fromIndex < 0) {
            console.error(fromIndex);
        }
        if (toIndex > length) {
            console.error(toIndex);
        }
    }

    function swap(indexVector, arr, i, j) {
        var temp = indexVector[i];
        indexVector[i] = indexVector[j];
        indexVector[j] = temp;
    }

    function dpqsort(indexVector, arr, left, right, div) {
        var len = right - left;

        if (len < 27) { // insertion sort for tiny array
            for (var i = left + 1; i <= right; i++) {
                for (var j = i; j > left && arr(indexVector[j]) < arr(indexVector[j - 1]); j--) {
                    swap(indexVector, arr, j, j - 1);
                }
            }
            return;
        }
        var third = Math.floor(len / div); //TODO: check if we need to round up or down or just nearest

        // 'medians'
        var m1 = left + third;
        var m2 = right - third;

        if (m1 <= left) {
            m1 = left + 1;
        }
        if (m2 >= right) {
            m2 = right - 1;
        }
        if (arr(indexVector[m1]) < arr(indexVector[m2])) {
            swap(indexVector, arr, m1, left);
            swap(indexVector, arr, m2, right);
        } else {
            swap(indexVector, arr, m1, right);
            swap(indexVector, arr, m2, left);
        }
        // pivots
        var pivot1 = arr(indexVector[left]);
        var pivot2 = arr(indexVector[right]);

        // pointers
        var less = left + 1;
        var great = right - 1;

        // sorting
        for (var k = less; k <= great; k++) {
            if (arr(indexVector[k]) < pivot1) {
                swap(indexVector, arr, k, less++);
            } else if (arr(indexVector[k]) > pivot2) {
                while (k < great && arr(indexVector[great]) > pivot2) {
                    great--;
                }
                swap(indexVector, arr, k, great--);

                if (arr(indexVector[k]) < pivot1) {
                    swap(indexVector, arr, k, less++);
                }
            }
        }
        // swaps
        var dist = great - less;

        if (dist < 13) {
            div++;
        }
        swap(indexVector, arr, less - 1, left);
        swap(indexVector, arr, great + 1, right);

        // subarrays
        dpqsort(indexVector, arr, left, less - 2, div);
        dpqsort(indexVector, arr, great + 2, right, div);

        // equal elements
        if (dist > len - 13 && pivot1 !== pivot2) {
            for (k = less; k <= great; k++) {
                if (arr(indexVector[k]) === pivot1) {
                    swap(indexVector, arr, k, less++);
                } else if (arr(indexVector[k]) === pivot2) {
                    swap(indexVector, arr, k, great--);

                    if (arr(indexVector[k]) === pivot1) {
                        swap(indexVector, arr, k, less++);
                    }
                }
            }
        }
        // subarray
        if (pivot1 < pivot2) {
            dpqsort(indexVector, arr, less, great, div);
        }
    }

    return {
        flashSort: flashSort,
        dualPivotQuickSort: dualPivotQuickSort,
        timSort: timSort,
        quickSort: quickSort,
        stableQuickSort: stableQuickSort,
        mergeSort: mergeSort,
        stableSort: stableSort
    };

})();
