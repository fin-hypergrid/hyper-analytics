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
    initialize: function(dataSource, treeView) {
        this.idColumnName = treeView.idColumn.name;
        this.parentIdColumnName = treeView.parentIdColumn.name;
    },

    /**
     * @param {number} columnIndex
     * @param {number} [direction=1]
     * @param {number} sortDepth - If greater than row depth, sorts on _edge value_ value; otherwise sorts on value of ancestor of this depth. "Edge" means a value that lexically comes before all others (ascending sort) or after all others (descending sort).
     * @memberOf DataSourceDepthSorter.prototype
     */
    sortOn: function(sortDepth, direction, columnIndex) {
        switch (direction) {
            case 0:
                this.clearIndex();
                break;

            case undefined:
            case 1:
            case -1:
                if (this.dataSource.getRowCount()) {
                    var getValue;

                    this.buildIndex();

                    // used in getValue:
                    this.depth = 0;
                    this.edge = direction === -1 ? +Infinity : -Infinity; // for numbers, date objects

                    if (columnIndex === undefined) {
                        getValue = getRowIndex.bind(this);
                    } else {
                        getValue = getColumnValue.bind(this);
                        this.columnName = this.dataSource.getFields()[columnIndex];
                        this.calculator = this.dataSource.getProperty('calculators')[columnIndex];
                        if (typeof getValue(0) === 'string') {
                            this.edge = direction === -1 ? '\uffff' : ''; // for strings
                        }
                    }

                    this.depth = sortDepth;
                    stableSort.sort(this.index, getValue, direction);
                }
                break;
        }
    }
});

function getRowIndex(rowIdx) {
    var dataRow = this.dataSource.getRow(rowIdx);

    if (dataRow.__DEPTH < this.depth) {
        return this.edge;
    }

    rowIdx = this.getDataIndex(rowIdx);

    // bubble up to group label of requested depth while either...
    while (
            // ...this is a leaf row
            dataRow.__EXPANDED === undefined ||
            // ...or: still deeper than the requested depth
            dataRow.__DEPTH > this.depth
        ) {
        dataRow = this.findRow(this.idColumnName, dataRow[this.parentIdColumnName]);
        rowIdx = this.getProperty('foundRowIndex');
    }

    return rowIdx;
}

function getColumnValue(rowIdx) {
    var dataRow = this.dataSource.getRow(rowIdx);

    if (dataRow.__DEPTH < this.depth) {
        return this.edge;
    }

    // bubble up to group label of requested depth while either...
    while (
        // ...this is a leaf row
        dataRow.__EXPANDED === undefined ||
        // ...or: still deeper than the requested depth
        dataRow.__DEPTH > this.depth
    ) {
        dataRow = this.findRow(this.idColumnName, dataRow[this.parentIdColumnName]);
    }

    return DataSourceIndexed.valOrFunc(dataRow, this.columnName, this.calculator);
}

module.exports = DataSourceDepthSorter;
