'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');

var DataSourceFilter = DataSourceIndexed.extend('DataSourceFilter', {

    initialize: function() {
        this.filters = [];
    },

    add: function(columnIndex, filter) {
        filter.columnIndex = columnIndex;
        this.filters.push(filter);
    },

    clearAll: function() {
        this.filters.length = 0;
        this.clearIndex();
    },

    applyAll: function() {
        if (!this.filters.length) {
            this.clearIndex();
        } else {
            this.buildIndex(applyFilter);
        }
    },

    getRowCount: function() {
        return this.filters.length ? this.index.length : this.dataSource.getRowCount();
    },

    aliases: {
        set: 'add'
    }
});

function applyFilter(r, rowObject) { // called in context from .buildIndex()
    var self = this;
    return this.filters.reduce(function(isFiltered, filter) {
        var cellValue = self.dataSource.getValue(filter.columnIndex, r);
        return isFiltered && filter(cellValue, rowObject, r);
    }, true);
}

module.exports = DataSourceFilter;