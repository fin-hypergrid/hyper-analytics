'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');
var DataSourceSorter = require('./DataSourceSorter');

/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataSourceSorterComposite = DataSourceIndexed.extend('DataSourceSorterComposite', {

    /**
     * @memberOf DataSourceSorterComposite.prototype
     */
    initialize: function() {
        /**
         * Caveats:
         *
         * 1. Columns should be uniquely represented (i.e., no repeats with same columnIndex)
         * 2. Columns should be added low- to high-order (i.e., most grouped columns come last)
         *
         * @type {number[]}
         * @memberOf DataSourceSorterComposite.prototype
         */
        this.sorts = [];

        /**
         * @type {DataSource}
         * @memberOf DataSourceSorterComposite.prototype
         */
        this.last = this.dataSource;
    },

    /**
     * @memberOf DataSourceSorterComposite.prototype
     * @param {number} y
     * @returns {Object}
     */
    getRow: function(y) {
        return this.last.getRow(y);
    },

    /**
     * @memberOf DataSourceSorterComposite.prototype
     * @param columnIndex
     * @param direction
     */
    sortOn: function(columnIndex, direction) {
        this.sorts.push([columnIndex, direction]);
    },

    /**
     * @memberOf DataSourceSorterComposite.prototype
     */
    apply: function() {
        var each = this.dataSource;

        this.sorts.forEach(function(sort) {
            each = new DataSourceSorter(each);
            each.sortOn.apply(each, sort);
        });

        this.last = each;
    },

    /**
     * @memberOf DataSourceSorterComposite.prototype
     */
    clearSorts: function() {
        this.sorts.length = 0;
        this.last = this.dataSource;
    },

    getDataIndex: function(y) {
        return this.last.getDataIndex(y);
    },

    /**
     * @memberOf DataSourceSorterComposite.prototype
     * @param {number} x
     * @param {number} y
     * @returns {*}
     */
    getValue: function(x, y) {
        return this.last.getValue(x, y);
    },

    /**
     * @memberOf DataSourceSorterComposite.prototype
     * @param {number} x
     * @param {number} y
     * @param {*} value
     */
    setValue: function(x, y, value) {
        this.last.setValue(x, y, value);
    }
});

DataSourceSorterComposite.prototype.applySorts = function() {
    (console.warn || console.log).call(console, 'applySorts deprecated; use apply');
    this.apply();
};

module.exports = DataSourceSorterComposite;
