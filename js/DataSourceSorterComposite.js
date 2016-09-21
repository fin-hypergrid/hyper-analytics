'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');
var DataSourceSorter = require('./DataSourceSorter');

/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataSourceSorterComposite = DataSourceIndexed.extend('DataSourceSorterComposite', {

    /**
     * @memberOf DataSourceSorterComposite#
     */
    initialize: function() {
        /**
         * Caveats:
         *
         * 1. Columns should be uniquely represented (i.e., no repeats with same columnIndex)
         * 2. Columns should be added low- to high-order (i.e., most grouped columns come last)
         *
         * @type {number[]}
         * @memberOf DataSourceSorterComposite#
         */
        this.sorts = [];

        /**
         * @type {DataSource}
         * @memberOf DataSourceSorterComposite#
         */
        this.last = this.dataSource;
    },

    /**
     * @memberOf DataSourceSorterComposite#
     * @param {number} y
     * @returns {Object}
     */
    getRow: function(y) {
        return this.last.getRow(y);
    },

    /**
     * @memberOf DataSourceSorterComposite#
     * @param columnIndex
     * @param direction
     */
    sortOn: function(columnIndex, direction) {
        this.sorts.push({ columnIndex: columnIndex, direction: direction });
    },

    /**
     *
     * @memberOf DataSourceSorterComposite#
     * @param {sorterFunction} [sorter] - If undefined, deletes sorter.
     */
    set: function(sorter) {
        if (sorter) {
            /**
             * @implements sorterInterfacei
             * @memberOf DataSourceSorterComposite#
             */
            this.sorter = sorter;
        } else {
            delete this.sorter;
        }
    },

    get: function() {
        return this.sorter;
    },

    /**
     * @memberOf DataSourceSorterComposite#
     */
    apply: function() {
        var each = this.dataSource;
        // get list of sorts from either API or use existing
        this.sorts = (this.sorter && this.sorter.prop('sorts')) || this.sorts;

        if (this.sorts) {
            this.sorts.forEach(function(sortSpec) {
                each = new DataSourceSorter(each);
                each.sortOn(sortSpec.columnIndex, sortSpec.direction, sortSpec.type);
            });
            this.last = each;
        }
    },

    /**
     * @memberOf DataSourceSorterComposite#
     */
    clearSorts: function() {
        this.sorts.length = 0;
        this.last = this.dataSource;
    },

    getDataIndex: function(y) {
        return this.last.getDataIndex(y);
    },

    /**
     * @memberOf DataSourceSorterComposite#
     * @param {number} x
     * @param {number} y
     * @returns {*}
     */
    getValue: function(x, y) {
        return this.last.getValue(x, y);
    },

    /**
     * @memberOf DataSourceSorterComposite#
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

Object.defineProperty(DataSourceSorterComposite.prototype, 'type', { value: 'sorter' }); // read-only property

module.exports = DataSourceSorterComposite;
