'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');
var stableSort = require('./util/stableSort');

/**
 * @classdesc Sorts on non-terminal tree node rows only (_i.e.,_ expandable rows with children).
 *
 * One of these sorters is created by {@link DataSourceTreeviewSorter} for each grouping level, starting with the maximum group level depth, and then one for each group level through the top level (0) sort depth.
 * @constructor
 * @param dataSource
 * @extends DataSourceIndexed
 */
var DataSourceDepthSorter = DataSourceIndexed.extend('DataSourceDepthSorter', {
    initialize: function(dataSource, treeView) {
        this.idColumnName = treeView.idColumn.name;
        this.parentIdColumnName = treeView.parentIdColumn.name;
    },

    /**
     * @desc Stable-sorts non-terminal tree node rows. Terminal (leaf) rows remain stable.
     * @param {number} groupLevel - If greater than row depth, sorts on an _edge value_ value, which is a value lexically inferior to (ascending sort) or superior to (descending sort) the row value.
     * Otherwise sorts on value of ancestor of this depth.
     *
     * @param {number} [direction=1] - One of:
     * `1` - Sort ascending.
     * `-1` - Sort descending.
     * @param {number} [columnIndex] - Sorts on the values in this column. Otherwise sorts on the row index.
     * @memberOf DataSourceDepthSorter#
     */
    sortOn: function(groupLevel, direction, columnIndex) {
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

                    this.depth = groupLevel;
                    stableSort.sort(this.index, getValue, direction);
                }
                break;
        }
    }
});

function getRowIndex(rowIdx) {
    var parentID,
        dataRow = this.dataSource.getRow(rowIdx);

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
        parentID = dataRow[this.parentIdColumnName];
        if (parentID == undefined) { break; }
        dataRow = this.findRow(this.idColumnName, parentID);
        rowIdx = this.getProperty('foundRowIndex');
    }

    return rowIdx;
}

function getColumnValue(rowIdx) {
    var parentID,
        dataRow = this.dataSource.getRow(rowIdx);

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
        parentID = dataRow[this.parentIdColumnName];
        if (parentID == undefined) { break; }
        dataRow = this.findRow(this.idColumnName, parentID);
    }

    return DataSourceIndexed.valOrFunc(dataRow, this.columnName, this.calculator);
}

module.exports = DataSourceDepthSorter;
