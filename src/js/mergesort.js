'use strict';

module.exports = (function() {

    function merge(dataSource, left, right) {
        var result = [];
        while (left.length > 0 && right.length > 0) {
            if (dataSource(left[0]) < dataSource(right[0])) {
                result.push(left.shift());
            } else {
                result.push(right.shift());
            }
        }
        return result.concat(left).concat(right);
    }

    function mergesort(indexVector, dataSource) {
        if (indexVector.length <= 1) {
            return indexVector;
        }
        var middle = Math.floor(indexVector.length / 2);
        var left = indexVector.slice(0, middle);
        var right = indexVector.slice(middle);
        return merge(dataSource, mergesort(left, dataSource), mergesort(right, dataSource));
    }

    function sort(indexVector, arr) {
        var indexes = mergesort(indexVector, arr);
        for (var i = 0; i < indexVector.length; i++) {
            indexVector[i] = indexes[i];
        }
    }

    return sort;
})();
