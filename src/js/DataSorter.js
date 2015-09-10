'use strict';

var Utils = require('./Utils.js');

module.exports = (function() {

    function DataSorter(data) {
        this.data = data;
        this.indexes = [];
        this.initializeIndexVector();
    }

    DataSorter.prototype.getValue = function(x, y) {

        var value = this.data.getValue(x, this.indexes[y]);
        return value;
    };

    DataSorter.prototype.getRow = function(y) {

        return this.data[this.indexes[y]];
    };

    DataSorter.prototype.setValue = function(x, y, value) {

        this.data.setValue(x, this.indexes[y], value);
    };

    DataSorter.prototype.getColumnCount = function() {

        return this.data.getColumnCount();
    };

    DataSorter.prototype.getRowCount = function() {

        return this.data.getRowCount();
    };

    DataSorter.prototype.sortOn = function(columnIndex) {
        this.initializeIndexVector();
        var self = this;
        Utils.stableSort(this.indexes, function(index) {
            return self.data.getValue(columnIndex, index);
        });
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
