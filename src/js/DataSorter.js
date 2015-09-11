'use strict';

var Utils = require('./Utils.js');

module.exports = (function() {

    function DataSorter(dataSource) {
        this.dataSource = dataSource;
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
        var value = this.dataSource.getValue(x, this.transposeY(y));
        return value;
    };

    DataSorter.prototype.getRow = function(y) {

        return this.dataSource.getRow(this.transposeY(y));
    };

    DataSorter.prototype.setValue = function(x, y, value) {

        this.dataSource.setValue(x, this.transposeY(y), value);
    };

    DataSorter.prototype.getColumnCount = function() {

        return this.dataSource.getColumnCount();
    };

    DataSorter.prototype.getRowCount = function() {

        return this.dataSource.getRowCount();
    };

    DataSorter.prototype.sortOn = function(columnIndex, sortType) {
        if (sortType === 0) {
            this.indexes.length = 0;
            return;
        }
        this.initializeIndexVector();
        var self = this;
        Utils.stableSort(this.indexes, function(index) {
            return self.dataSource.getValue(columnIndex, index);
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
