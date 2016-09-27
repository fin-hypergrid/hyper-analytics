'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');

/**
 * @interface filterInterface
 */

/**
 * @name filterInterface#test
 * @method
 * @param {object} dataRow - Object representing a row in the grid containing all the fields listed in {@link DataSource#fields|fields}.
 * @returns {boolean}
 * * `true` - include in grid (row passes through filter)
 * * `false` - exclude from grid (row is blocked by filter)
 */

/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataSourceGlobalFilter = DataSourceIndexed.extend('DataSourceGlobalFilter', {

    /**
     *
     * @memberOf DataSourceGlobalFilter#
     * @param {filterFunction} [filter] - If undefined, deletes filter.
     */
    set: function(filter) {
        if (filter) {
            /**
             * @implements filterInterface
             * @memberOf DataSourceGlobalFilter#
             */
            this.filter = filter;
        } else {
            delete this.filter;
        }
    },

    get: function(filter) {
        return this.filter;
    },

    sortGroups: function(sorter){
        this.dataSource.sortGroups(sorter);
    },

    /**
     *
     * @memberOf DataSourceGlobalFilter#
     */
    apply: function() {
        if (this.filter && this.filter.test) {
            this.buildIndex(this.filterTest);
        } else {
            this.clearIndex();
        }
    },

    /**
     * @implements filterPredicate
     * @memberOf DataSourceGlobalFilter#
     */
    filterTest: function(r, rowObject) {
        return this.filter.test(rowObject);
    },


    /**
     *
     * @memberOf DataSourceGlobalFilter#
     * @returns {number}
     */
    getRowCount: function() {
        return this.filter && this.filter.test ? this.index.length : this.dataSource.getRowCount();
    }
});

Object.defineProperty(DataSourceGlobalFilter.prototype, 'type', { value: 'filter' }); // read-only property

module.exports = DataSourceGlobalFilter;
