'use strict';

var DataSource = require('./DataSource');

var DataSourceGlobalFilter = DataSource.extend({
    prototype: {
        setFilter: function(filter) {
            this.filter = filter;
        },

        clearFilters: function() {
            delete this.filter;
            this.clearIndex();
        },

        applyFilters: function() {
            if (!this.filter) {
                this.clearIndex();
            } else {
                this.buildIndex(applyFilter);
            }
        },

        getRowCount: function() {
            var result;

            if (this.index && this.index.length) {
                result = this.index.length; // indexed data -> num hits in index
            } else if (this.filter) {
                result = 0; // non-indexed data but active global filter -> 0 (no hits)
            } else {
                result = this.getUnfilteredRowCount(); // non-indexed data with inactive global filter: all rows
            }

            return result;
        }
    }
});

function applyFilter(r, rowObject) {
    var self = this;
    return this.getFields().find(function(columnIndex) {
        var cellValue = self.getUnfilteredValue(columnIndex, r);
        return self.filter(cellValue, rowObject, r);
    });
}

module.exports = DataSourceGlobalFilter;