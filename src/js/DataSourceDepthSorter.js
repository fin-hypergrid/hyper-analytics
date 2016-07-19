'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');
var stableSort = require('./util/stableSort');

/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataSourceDepthSorter = DataSourceIndexed.extend('DataSourceDepthSorter', {
    initialize: function(dataSource, idColumnName, parentIdColumnName) {
        this.idColumnName = idColumnName;
        this.parentIdColumnName = parentIdColumnName;
    },

    /**
     * @memberOf DataSourceDepthSorter.prototype
     * @param {number} columnIndex
     * @param {number} [direction=1]
     */
    sortOn: function(columnIndex, direction, depth) {
        var self = this, // used in getValue
            dataSource = this.dataSource,
            columnName = dataSource.getFields()[columnIndex];

        switch (direction) {
            case 0:
                this.clearIndex();
                break;

            case undefined:
            case 1:
            case -1:
                if (dataSource.getRowCount()) {
                    var numeric = typeof getValue(0) === 'number';
                    var edge = direction === -1 // used in getValue
                        ? (numeric ? +Infinity : '\uffff')
                        : (numeric ? -Infinity : '');

                    stableSort.sort(this.buildIndex(), getValue, direction);
                }
                break;
        }

        function getValue(rowIdx) {
            var dataRow = dataSource.getRow(rowIdx);

            if (dataRow.__DEPTH < depth) {
                return edge;
            } else {
                while (dataRow.__DEPTH > depth) {
                    dataRow = self.findRow(self.idColumnName, dataRow[self.parentIdColumnName]);
                }
            }

            return DataSourceIndexed.valOrFunc(dataRow, columnName);
        }
    }
});

module.exports = DataSourceDepthSorter;
