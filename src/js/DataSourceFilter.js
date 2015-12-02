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
            this.buildIndex(applyFilters);
        }
    },

    getRowCount: function() {
        return this.filters.length ? this.index.length : this.dataSource.getRowCount();
    },

    aliases: {
        set: 'add'
    }
});

function applyFilters(r, rowObject) { // called in context from .buildIndex()
    var self = this;

    // double negative here means "no filter fails" (i.e., row passes all filters)
    return !this.filters.find(function(filter) {
        return !filter(self.dataSource.getValue(filter.columnIndex, r), rowObject, r);
    });
}

module.exports = DataSourceFilter;
