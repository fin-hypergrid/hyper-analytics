'use strict';

module.exports = (function () {

    var count = function ( /* columIndex */ ) {
        return function (group) {
            var rows = group.getRowCount();
            return rows;
        }
    };

    var sum = function (columIndex) {
        return function (group) {
            var sum = 0;
            var rows = group.getRowCount();
            for (var r = 0; r < rows; r++) {
                sum = sum + group.getValue(columIndex, r);
            }
            return sum;
        }
    };

    var min = function (columIndex) {
        return function (group) {
            var min = 0;
            var rows = group.getRowCount();
            for (var r = 0; r < rows; r++) {
                min = Math.min(min, group.getValue(columIndex, r));
            }
            return min;
        }
    };


    var max = function (columIndex) {
        return function (group) {
            var max = 0;
            var rows = group.getRowCount();
            for (var r = 0; r < rows; r++) {
                max = Math.max(max, group.getValue(columIndex, r));
            }
            return max;
        }
    };

    var avg = function (columIndex) {
        return function (group) {
            var sum = 0;
            var rows = group.getRowCount();
            for (var r = 0; r < rows; r++) {
                sum = sum + group.getValue(columIndex, r);
            }
            return sum / rows;
        }
    };

    var first = function (columIndex) {
        return function (group) {
            return group.getValue(columIndex, 0);
        }
    };

    var last = function (columIndex) {
        return function (group) {
            var rows = group.getRowCount();
            return group.getValue(columIndex, rows - 1);
        }
    };

    var stddev = function (columIndex) {
        return function (group) {
            var sum = 0;
            var rows = group.getRowCount();
            for (var r = 0; r < rows; r++) {
                sum = sum + group.getValue(columIndex, r);
            }
            var mean = sum / rows;
            var variance = 0;
            for (var r = 0; r < rows; r++) {
                var dev = (group.getValue(columIndex, r) - mean);
                variance = variance + (dev * dev);
            }
            var stddev = Math.sqrt(variance / rows);
            return stddev;
        }
    };

    return {
        count: count,
        sum: sum,
        min: min,
        max: max,
        avg: avg,
        first: first,
        last: last,
        stddev: stddev
    };

})();