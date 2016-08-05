'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');
var stableSort = require('./util/stableSort');

/**
 * Used by `DataSourceTreeviewSorter`.
 * One of these data sources should be created for each sort depth, starting with the maximum sort depth, and then one for each sort depth through the top (0) sort depth.
 * @constructor
 * @extends DataSourceIndexed
 */
var DataSourceDepthSorter = DataSourceIndexed.extend('DataSourceDepthSorter', {
    initialize: function(dataSource, idColumn, parentIdColumn) {
        this.idColumn = idColumn;
        this.parentIdColumn = parentIdColumn;
    },

    /**
     * @param {number} columnIndex
     * @param {number} [direction=1]
     * @param {number} sortDepth - If greater than row depth, sorts on _edge value_ value; otherwise sorts on value of ancestor of this depth. "Edge" means a value that lexically comes before all others (ascending sort) or after all others (descending sort).
     * @memberOf DataSourceDepthSorter.prototype
     */
    sortOn: function(columnIndex, direction, sortDepth) {
        var columnName = this.dataSource.getFields()[columnIndex],
            calculator = this.dataSource.getCalculators()[columnIndex],
            self = this, // used in getValue
            depth = 0,
            numeric, edge;

        switch (direction) {
            case 0:
                this.clearIndex();
                break;

            case undefined:
            case 1:
            case -1:
                if (this.dataSource.getRowCount()) {
                    this.buildIndex();
                    numeric = typeof getValue(0) !== 'string'; // works with date objects as well as numbers
                    edge = direction === -1 // used in getValue
                        ? (numeric ? +Infinity : '\uffff')
                        : (numeric ? -Infinity : '');
                    depth = sortDepth;
                    stableSort.sort(this.index, getValue, direction);
                }
                break;
        }

        function getValue(rowIdx) {
            var dataRow = self.dataSource.getRow(rowIdx);

            if (dataRow.__DEPTH < depth) {
                return edge;
            } else {
                while (dataRow.__DEPTH > depth) {
                    dataRow = self.findRow(self.idColumn.name, dataRow[self.parentIdColumn.name]);
                }
            }

            return DataSourceIndexed.valOrFunc(dataRow, columnName, calculator);
        }
    }
});

module.exports = DataSourceDepthSorter;
