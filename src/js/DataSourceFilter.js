'use strict';

var DataSource = require('./DataSource');

var DataSourceFilter = DataSource.extend({
    initialize: function() {
        this.filters = [];
    },

    prototype: {
        addFilter: function(columnIndex, filter) {
            filter.columnIndex = columnIndex;
            this.filters.push(filter);
        },

        clearFilters: function() {
            this.filters.length = 0;
            this.clearIndex();
        },

        applyFilters: function() {
            if (!this.filters.length) {
                this.clearIndex();
            } else {
                this.buildIndex(applyFilter);
            }
        },

        getRowCount: function() {
            var result;

            if (this.index && this.index.length) {
                result = this.index.length; // indexed data -> num hits in index
            } else if (this.filters.length) {
                result = 0; // non-indexed data but active filter(s) -> 0 (no hits)
            } else {
                result = this.getUnfilteredRowCount(); // non-indexed data with inactive filter(s): all rows
            }

            return result;
        }
    },

    aliases: {
        setFilter: 'addFilter'
    }
});

function applyFilter(r, rowObject) {
    var self = this;
    return this.filters.find(function(filter) {
        var cellValue = self.getUnfilteredValue(filter.columnIndex, r, true);
        return filter(cellValue, rowObject, r);
    });
}

module.exports = DataSourceFilter;