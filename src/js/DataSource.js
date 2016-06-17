'use strict';

var Base = require('./Base');
var headerify = require('./util/headerify');

/**
 * @constructor
 * @param {object[]} data
 * @param {string[]} fields
 */
var DataSource = Base.extend('DataSource', {
    initialize: function(data, fields) {
        /**
         * @type {string[]}
         */
        this.fields = fields || computeFieldNames(data[0]);

        /**
         * @type {object[]}
         */
        this.data = data;
    },

    isNullObject: false,

    getDataIndex: function(y) {
        return y;
    },

    /**
     * @memberOf DataSource.prototype
     * @param y
     * @returns {object[]}
     */
    getRow: function(y) {
        return this.data[y];
    },

    findRow: function(columnName, value) {
        return this.data.find(function(row) { return row[columnName] === value; });
    },

    /**
     * @memberOf DataSource.prototype
     * @param x
     * @param y
     * @returns {*}
     */
    getValue: function(x, y) {
        var row = this.getRow(y);
        if (!row) {
            return null;
        }
        return row[this.fields[x]];
    },

    /**
     * @memberOf DataSource.prototype
     * @param {number} x
     * @param {number} y
     * @param value
     */
    setValue: function(x, y, value) {
        this.getRow(y)[this.fields[x]] = value;
    },

    /**
     * @memberOf DataSource.prototype
     * @returns {number}
     */
    getRowCount: function() {
        return this.data.length;
    },

    /**
     * @memberOf DataSource.prototype
     * @returns {number}
     */
    getColumnCount: function() {
        return this.getFields().length;
    },

    /**
     * @memberOf DataSource.prototype
     * @returns {number[]}
     */
    getFields: function() {
        return this.fields;
    },

    /**
     * @memberOf DataSource.prototype
     * @returns {string[]}
     */
    getHeaders: function() {
        return (
            this.headers = this.headers || this.getDefaultHeaders().map(function(each) {
                return headerify.transform(each);
            })
        );
    },

    /**
     * @memberOf DataSource.prototype
     * @returns {string[]}
     */
    getDefaultHeaders: function() {
        return this.getFields();
    },

    /**
     * @memberOf DataSource.prototype
     * @param {string[]} fields
     */
    setFields: function(fields) {
        this.fields = fields;
    },

    /**
     * @memberOf DataSource.prototype
     * @param {string[]} headers
     */
    setHeaders: function(headers) {
        if (!(headers instanceof Array)) {
            error('setHeaders', 'param #1 `headers` not array');
        }
        this.headers = headers;
    },

    /**
     * @memberOf DataSource.prototype
     */
    getGrandTotals: function() {
        //nothing here
    },

    /**
     * @memberOf DataSource.prototype
     * @param arrayOfUniformObjects
     */
    setData: function(arrayOfUniformObjects) {
        this.data = arrayOfUniformObjects;
    }
});

function error(methodName, message) {
    throw new Error('DataSource.' + methodName + ': ' + message);
}

/**
 * @private
 * @param {object} object
 * @returns {string[]}
 */
function computeFieldNames(object) {
    if (!object) {
        return [];
    }
    return Object.getOwnPropertyNames(object || []).filter(function(e) {
        return e.substr(0, 2) !== '__';
    });
}

module.exports = DataSource;
