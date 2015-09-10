'use strict';

var Utils = require('./Utils.js');

module.exports = (function() {

    function DataSorter(data) {
        this.data = data;
        this.indexes = [];
        this.descendingSort = false;
    }

    DataSorter.prototype.transposeY = function(y) {
        if (this.indexes.length !== 0) {
            return this.indexes[y];
        }
        return y;
    };

    DataSorter.prototype.getValue = function(x, y) {
        var value = this.data.getValue(x, this.transposeY(y));
        return value;
    };

    DataSorter.prototype.getRow = function(y) {

        return this.data.getRow(this.transposeY(y));
    };

    DataSorter.prototype.setValue = function(x, y, value) {

        this.data.setValue(x, this.transposeY(y), value);
    };

    DataSorter.prototype.getColumnCount = function() {

        return this.data.getColumnCount();
    };

    DataSorter.prototype.getRowCount = function() {

        return this.data.getRowCount();
    };

    DataSorter.prototype.sortOn = function(columnIndex, sortType) {
        if (sortType === 0) {
            this.indexes.length = 0;
            return;
        }
        this.initializeIndexVector();
        var self = this;
        Utils.stableSort(this.indexes, function(index) {
            return self.data.getValue(columnIndex, index);
        }, sortType);
    };

    DataSorter.prototype.initializeIndexVector = function() {
        var rowCount = this.getRowCount();
        var indexVector = new Array(rowCount);
        for (var r = 0; r < rowCount; r++) {
            indexVector[r] = r;
        }
        this.indexes = indexVector;
    };

    return DataSorter;

})();
