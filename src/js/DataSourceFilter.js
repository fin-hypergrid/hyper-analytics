'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');

/**
 * @constructor
 * @extends DataSourceIndexed
 */
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

/**
 * @private
 * @type filterPredicate
 */
function applyFilters(r, rowObject) { // called in context from .buildIndex()
    var i = this.filters.length;

    while (i--) {
        if (!this.filters[i](this.dataSource.getValue(this.filters[i].columnIndex, r), rowObject, r)) {
            return false;  // a column filter failed: row is disqualified
        }
    }

    return true; // no column filter failed: row is qualified
}

module.exports = DataSourceFilter;
