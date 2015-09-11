'use strict';

module.exports = (function() {

    function DataFilter(dataSource) {
        this.dataSource = dataSource;
        this.indexes = [];
        this.filters = [];
    }

    DataFilter.prototype.transposeY = function(y) {
        if (this.indexes.length !== 0) {
            return this.indexes[y];
        }
        return y;
    };

    DataFilter.prototype.getValue = function(x, y) {
        var value = this.dataSource.getValue(x, this.transposeY(y));
        return value;
    };

    DataFilter.prototype.getRow = function(y) {

        return this.dataSource.getRow(this.transposeY(y));
    };

    DataFilter.prototype.setValue = function(x, y, value) {

        this.dataSource.setValue(x, this.transposeY(y), value);
    };

    DataFilter.prototype.getColumnCount = function() {

        return this.dataSource.getColumnCount();
    };

    DataFilter.prototype.getRowCount = function() {
        if (this.filters.length === 0) {
            return this.dataSource.getRowCount();
        }
        return this.indexes.length;
    };

    DataFilter.prototype.addFilter = function(filter) {
        this.filters.push(filter);
        this.applyFilters();
    };

    DataFilter.prototype.clearFilters = function(filter) {
        this.filters.length = 0;
        this.indexes.length = 0;
    };

    DataFilter.prototype.applyFilters = function() {
        var indexes = this.indexes;
        indexes.length = 0;
        var count = this.dataSource.getRowCount();
        for (var r = 0; r < count; r++) {
            if (this._applyFiltersTo(r)) {
                indexes.push(r);
            }
        }
    };

    DataFilter.prototype._applyFiltersTo = function(r) {
        var filters = this.filters;
        for (var f = 0; f < filters.length; f++) {
            var filter = filters[f];
            var rowObject = this.dataSource.getRow(r);
            if (filter(this.dataSource.getValue(filter.columnIndex,r),rowObject,r)) {
                return true;
            }
        }
        return false;
    };

    return DataFilter;

})();
