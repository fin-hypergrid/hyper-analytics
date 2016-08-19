'use strict';

var Base = require('./Base');

/**
 * @param dataSource
 * @constructor
 */
var DataSourceIndexed = Base.extend('DataSourceIndexed', {

    isNullObject: false,

    /**
     * @memberOf DataSourceIndexed#
     * @param dataSource
     */
    initialize: function(dataSource) {
        this.dataSource = dataSource;
        this.index = [];
    },

    /**
     * @memberOf DataSourceIndexed#
     * @param y
     * @returns {*}
     */
    transposeY: function(y) {
        return this.index.length ? this.index[y] : y;
    },

    getDataIndex: function(y) {
        return this.dataSource.getDataIndex(this.transposeY(y));
    },

    /**
     * @memberOf DataSourceIndexed#
     * @param y
     * @returns {object}
     */
    getRow: function(y) {
        return this.dataSource.getRow(this.transposeY(y));
    },

    /**
     * @memberOf DataSourceIndexed#
     * @param x
     * @param y
     * @returns {*|Mixed}
     */
    getValue: function(x, y) {
        return this.dataSource.getValue(x, this.transposeY(y));
    },

    /**
     * @memberOf DataSourceIndexed#
     * @param {number} x
     * @param {number} y
     * @param {*} value
     */
    setValue: function(x, y, value) {
        this.dataSource.setValue(x, this.transposeY(y), value);
    },

    /**
     * @memberOf DataSourceIndexed#
     * @returns {Number|*}
     */
    getRowCount: function() {
        return this.index.length || this.dataSource.getRowCount();
    },

    /**
     *
     * @returns {*}
     * @memberOf DataSourceIndexed#
     */
    getColumnCount: function() {
        return this.dataSource.getColumnCount();
    },

    /**
     * @memberOf DataSourceIndexed#
     * @returns {*}
     */
    getFields: function() {
        return this.dataSource.getFields();
    },

    /**
     * @memberOf DataSourceIndexed#
     * @param fields
     * @returns {*}
     */
    setFields: function(fields) {
        return this.dataSource.setFields(fields);
    },

    /**
     * @memberOf DataSourceIndexed#
     * @param {string[]} headers
     * @returns {string[]}
     */
    setHeaders: function(headers) {
        return this.dataSource.setHeaders(headers);
    },

    /**
     *
     * @returns {string[]}
     * @memberOf DataSourceIndexed#
     */
    getHeaders: function() {
        return this.dataSource.getHeaders();
    },

    /**
     * @memberOf DataSourceIndexed#
     * @returns {*}
     */
    getGrandTotals: function() {
        return this.dataSource.getGrandTotals();
    },

    /**
     * @memberOf DataSourceIndexed#
     * @param {object[]} arrayOfUniformObjects
     * @returns {object[]}
     */
    setData: function(arrayOfUniformObjects) {
        return this.dataSource.setData(arrayOfUniformObjects);
    },

    /**
     * @memberOf DataSourceIndexed#
     */
    clearIndex: function() {
        this.index.length = 0;
    },

    /**
     * @memberOf DataSourceIndexed#
     * @param {filterPredicate} predicate
     * @returns {number[]}
     */
    buildIndex: function(predicate) {
        var rowCount = this.dataSource.getRowCount(),
            index = this.index;

        this.clearIndex();

        for (var r = 0; r < rowCount; r++) {
            if (!predicate || predicate.call(this, r, this.dataSource.getRow(r))) {
                index.push(r);
            }
        }

        return index;
    }
});

/** @typedef {function} filterPredicate
 * @summary Applies filter to given row.
 * @param {nubmer} r - Row index of row data within rows array `this.dataSource.data[]`.
 * @param {object} rowObject - Row data; element of `this.dataSource.data[]`.
 * @returns {boolean} Row qualifies (passes through filter).
 */

/**
 * Used by the sorters (`DataSourceSorter` and `DataSourceTreeviewSorter`).
 * @param {object} dataRow
 * @param {string} columnName
 * @returns {*}
 */
DataSourceIndexed.valOrFunc = function(dataRow, columnName, calculator) {
    var result;
    if (dataRow) {
        result = dataRow[columnName];
        calculator = (typeof result)[0] === 'f' && result || calculator;
        if (calculator) {
            result = calculator(dataRow, columnName);
        }
    }
    return result;
};

module.exports = DataSourceIndexed;
