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
    initialize: function(dataSource, treeViewSorter) {
        this.idColumnName = treeViewSorter.idColumn.name;
        this.parentIdColumnName = treeViewSorter.parentIdColumn.name;
        this.sortColumnIndex = treeViewSorter.defaultSortColumn.index;
    },

    /**
     * @param {number} columnIndex
     * @param {number} [direction=1]
     * @param {number} sortDepth - If greater than row depth, sorts on _edge value_ value; otherwise sorts on value of ancestor of this depth. "Edge" means a value that lexically comes before all others (ascending sort) or after all others (descending sort).
     * @memberOf DataSourceDepthSorter.prototype
     */
    sortOn: function(columnIndex, direction, sortDepth) {
        switch (direction) {
            case 0:
                this.clearIndex();
                break;

            case undefined:
            case 1:
            case -1:
                if (this.dataSource.getRowCount()) {
                    this.buildIndex();

                    // used in getValue:
                    this.depth = 0;
                    this.isSortColumn = columnIndex === this.sortColumnIndex;
                    this.columnName = this.dataSource.getFields()[columnIndex];
                    this.calculator = this.dataSource.getCalculators()[columnIndex];

                    var numeric = typeof getValue.call(this, 0) !== 'string'; // works with date objects as well as numbers
                    this.edge = direction === -1
                        ? (numeric ? +Infinity : '\uffff')
                        : (numeric ? -Infinity : '');

                    this.depth = sortDepth;
                    stableSort.sort(this.index, getValue.bind(this), direction);
                }
                break;
        }
    }
});

function getValue(rowIdx) {
    var dataRow = this.dataSource.getRow(rowIdx);

    if (dataRow.__DEPTH < this.depth) {
        return this.edge;
    }

    // bubble up to group label of requested depth while either...
    while (
        // ...in tree column AND this is a leaf row
        this.isSortColumn && dataRow.__EXPANDED === undefined ||
        // ...still deeper than the requested depth
        dataRow.__DEPTH > this.depth
    ) {
        dataRow = this.findRow(this.idColumnName, dataRow[this.parentIdColumnName]);
    }

    return DataSourceIndexed.valOrFunc(dataRow, this.columnName, this.calculator);
}

module.exports = DataSourceDepthSorter;
