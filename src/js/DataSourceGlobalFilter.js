'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');

/**
 * @typedef {function} filterFunction
 * @param cellValue
 * @param {object} rowObject - Reference to `this.dataSource.data[r]`.
 * @param {number} r - Row number (index within `this.dataSource.data`).
 */

/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataSourceGlobalFilter = DataSourceIndexed.extend('DataSourceGlobalFilter', {

    /**
     *
     * @memberOf DataSourceGlobalFilter.prototype
     * @param filter
     */
    set: function(filter) {
        /**
         * @type {filterFunction}
         * @memberOf DataSourceGlobalFilter.prototype
         */
        this.filter = filter;
    },

    /**
     *
     * @memberOf DataSourceGlobalFilter.prototype
     */
    clear: function() {
        delete this.filter;
        this.clearIndex();
    },

    /**
     *
     * @memberOf DataSourceGlobalFilter.prototype
     * @param {object} visibleColumns
     */
    apply: function(visibleColumns) {
        if (!this.filter) {
            this.clearIndex();
        } else {
            var visibleColumnMap = this.visibleColumnMap = [];
            visibleColumns.forEach(function(column) {
                visibleColumnMap.push(column.index);
            });
            this.buildIndex(applyFilter);
        }
    },

    /**
     *
     * @memberOf DataSourceGlobalFilter.prototype
     * @returns {number}
     */
    getRowCount: function() {
        return this.filter ? this.index.length : this.dataSource.getRowCount();
    }
});

/**
 * *private
 * @param {nubmer} r
 * @param {object} rowObject
 */
function applyFilter(r, rowObject) { // called in context from .buildIndex()
    var self = this;
    return this.visibleColumnMap.find(function(columnIndex, mapIndex) {
        var cellValue = self.dataSource.getValue(columnIndex, r);
        return self.filter(cellValue, rowObject, r);
    });
}

module.exports = DataSourceGlobalFilter;
