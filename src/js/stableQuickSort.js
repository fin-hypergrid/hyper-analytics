'use strict';

var SortTypes = {
    ASCENDING:"ascending",
    DESCENDING:"descending",
    NONE:"none"
}

var compare = function(indexVector, dataSource, first, last, type) {
    //return;
    var x = dataSource(indexVector[first]), y = dataSource(indexVector[last]);

    if (typeof(x) === "number") {

        // Numbers are compared by subtraction
        if (type === SortTypes.ASCENDING) {
            if (y === null) return -1;
            return x-y;
        } else {
            if (y === null) return 1;
            return y-x;
        }
    } else {

        // Anything not a number gets compared using the relational operators
        if (type === SortTypes.ASCENDING) {
            if (y === null) return -1;
            return x<y?-1:1;
        } else {
            if (y === null) return 1;
            return y<x?-1:1;
        }
    }
    return 0;
}

module.exports = (function() {

    function stableQuickSort(indexVector, dataSource, oneZeroOrMinusOneType) {
        var type;
        if (oneZeroOrMinusOneType === undefined) {
            oneZeroOrMinusOneType = 1;
        }
        switch(oneZeroOrMinusOneType) {
            case -1:
                type = SortTypes.DESCENDING;
                break;
            case 0:
                type = SortTypes.NONE;
                break;
            case 1:
                type = SortTypes.ASCENDING;
                break;
        }
        if (type === SortTypes.NONE) {
            for (var i = 0; i < indexVector.length; i++) {
                indexVector[i] = i;
            }
            return;
        }
        quicksort(indexVector, dataSource, 1, indexVector.length - 1, type);
    }

    function swap(indexVector, x, y) {
        var tmp = indexVector[x];
        indexVector[x] = indexVector[y];
        indexVector[y] = tmp;
        if (tmp === undefined || indexVector[x] === undefined) {
            console.log('halt');
        }

    }

    function quicksort(indexVector, dataSource, first, last, type) {
        // In place quickstort, stable.  We cant use the inbuilt Array.sort() since its a hybrid sort
        // potentially and may not be stable (non quicksort) on small sizes.
        // if (1 === 1) {
        //     return;
        // }
        while (first < last)
        {
            var right   = last;
            var left    = first;
            var pivot = (first+last)>>1;

            if (pivot < 0 || pivot >= last) {
                break;
            }

            while(right >= left) {

                while (left <= right && compare(indexVector, dataSource, left, pivot, type) <= 0) {
                    ++left;
                }

                while (left <= right && compare(indexVector, dataSource, right, pivot, type) > 0) {
                    --right;
                }

                if (left > right) {
                    break;
                }

                swap(indexVector, left,right);

                if (pivot === right) {
                    pivot = left;
                }

                left++;
                right--;

            }

            swap(indexVector, pivot, right);
            right--;

            // Use recursion to sort the smallest partition, this increases performance.
            if (Math.abs(right-first) > Math.abs(last-left)) {
                if (left < last) quicksort(indexVector, dataSource, left, last, type);
                last = right;
            }
            else  {
                if (first < right) quicksort(indexVector, dataSource, first, right, type);
                first = left;
            }
        }
    }

    return stableQuickSort;

})();


