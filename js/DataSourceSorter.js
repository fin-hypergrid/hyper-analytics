'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');
var stableSort = require('./util/stableSort');

/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataSourceSorter = DataSourceIndexed.extend('DataSourceSorter', {
    /**
     * @memberOf DataSourceSorter#
     * @param {number} columnIndex
     * @param {number} [direction=1]
     */
    sortOn: function(columnIndex, direction, type) {
        var dataSource = this.dataSource,
            columnName = dataSource.getFields()[columnIndex],
            calculator = dataSource.schema[columnIndex] && dataSource.schema[columnIndex].calculator;

        switch (direction) {
            case 0:
                this.clearIndex();
                break;

            case undefined:
            case 1:
            case -1:
                stableSort.sort(this.buildIndex(), getValue, direction, type);
                break;
        }

        function getValue(rowIdx) {
            var dataRow = dataSource.getRow(rowIdx);
            return DataSourceIndexed.valOrFunc(dataRow, columnName, calculator);
        }
    }
});

module.exports = DataSourceSorter;
