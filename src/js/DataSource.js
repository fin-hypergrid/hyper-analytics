'use strict';

var headerify = require('./util/headerify');
var extendify = require('./util/extendify');

function DataSource(data, fields) {
    this.fields = fields || computeFieldNames(data[0]);
    this.data = data;
}

extendify(DataSource, 'dataSource');

DataSource.prototype = {
    constructor: DataSource.prototype.constructor,

    isNullObject: false,

    // Unfiltered functions ignore `index` even when defined:

    getUnfilteredRow: function(y) {
        return this.data[y];
    },

    getUnfilteredValue: function(x, y) {
        var row = this.getUnfilteredRow(y);
        if (!row) {
            return null;
        }
        return row[this.fields[x]];
    },

    setUnfilteredValue: function(x, y, value) {
        this.getUnfilteredRow(y)[this.fields[x]] = value;
    },

    getUnfilteredRowCount: function() {
        return this.data.length;
    },

    // Filtered functions respect `index` when defined:

    getRow: function(y) {
        if (this.index) {
            y = this.index[y];
        }
        return this.data[y];
    },

    getValue: function(x, y) {
        var row = this.getRow(y);
        if (!row) {
            return null;
        }
        return row[this.fields[x]];
    },

    setValue: function(x, y, value) {
        this.getRow(y)[this.fields[x]] = value;
    },

    getRowCount: function() {
        return (this.index || this.data).length;
    },

    // Remaining methods do not depend on `index`:

    getColumnCount: function() {
        return this.getFields().length;
    },

    getFields: function() {
        return this.fields;
    },

    getHeaders: function() {
        return (
            this.headers = this.headers ||
            this.getDefaultHeaders().map(function(each) {
                return headerify(each);
            })
        );
    },

    getDefaultHeaders: function() {
        return this.getFields();
    },

    setFields: function(fields) {
        this.fields = fields;
    },

    setHeaders: function(headers) {
        if (!(headers instanceof Array)) {
            error('setHeaders', 'param #1 `headers` not array');
        }
        this.headers = headers;
    },

    getGrandTotals: function() {
        //nothing here
        return;
    },

    clearIndex: function() {
        delete this.index;
    },

    buildIndex: function(predicate) {
        var rowCount = this.getRowCount(),
            index = this.index = [];

        for (var r = 0; r < rowCount; r++) {
            if (!predicate || predicate.call(this, r, this.getUnfilteredRow(r))) {
                index.push(r);
            }
        }
    },

    setData: function(arrayOfUniformObjects) {
        this.data = arrayOfUniformObjects;
    }
};

function error(methodName, message) {
    throw new Error('DataSource.' + methodName + ': ' + message);
}

function computeFieldNames(object) {
    if (!object) {
        return [];
    }
    var fields = [].concat(Object.getOwnPropertyNames(object).filter(function(e) {
        return e.substr(0, 2) !== '__';
    }));
    return fields;
}

module.exports = DataSource;