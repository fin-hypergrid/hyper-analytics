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
     * @param {object} [filter] - If undefined, deletes filter.
     */
    set: function(filter) {
        if (filter) {
            /**
             * @type {filterFunction}
             * @memberOf DataSourceGlobalFilter.prototype
             */
            this.filter = filter;
        } else {
            delete this.filter;
        }
    },

    get: function(filter) {
        return this.filter;
    },

    /**
     *
     * @memberOf DataSourceGlobalFilter.prototype
     */
    apply: function() {
        if (!this.filter) {
            this.clearIndex();
        } else {
            this.buildIndex(function applyFilter(r, rowObject) {
                return this.filter.test(rowObject);
            });
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

module.exports = DataSourceGlobalFilter;
