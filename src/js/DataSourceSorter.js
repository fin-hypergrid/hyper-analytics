'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');
var stableSort = require('./util/stableSort');

/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataSourceSorter = DataSourceIndexed.extend('DataSourceSorter', {

    /**
     * @memberOf DataSourceSorter.prototype
     */
    initialize: function() {
        /**
         * @memberOf DataSourceSorter.prototype
         * @type {boolean}
         */
        this.descendingSort = false; // TODO: this does not seem to be in use
    },

    /**
     * @memberOf DataSourceSorter.prototype
     * @param {number} columnIndex
     * @param {number} [direction=1]
     */
    sortOn: function(columnIndex, direction) {
        var dataSource = this.dataSource,
            columnName = dataSource.getFields()[columnIndex];

        switch (direction) {
            case 0:
                this.clearIndex();
                break;

            case undefined:
            case 1:
            case -1:
                stableSort.sort(this.buildIndex(), getValue, direction);
                break;
        }

        function getValue(rowIdx) {
            return valOrFunc(dataSource.getRow(rowIdx), columnName);
        }
    }
});

/**
 * @private
 * @param {*|function} valOrFunc
 * @returns {*}
 */
function valOrFunc(dataRow, columnName) {
    var vf = dataRow[columnName];
    return (typeof vf)[0] === 'f' ? vf(dataRow, columnName) : vf;
}

module.exports = DataSourceSorter;
