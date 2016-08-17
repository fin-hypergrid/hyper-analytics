'use strict';

function Base() {}
Base.extend = require('extend-me');

Base.prototype = {
    constructor: Base.prototype.constructor,

    replaceIndent: '_',

    getHeaders: function() {
        if (this.dataSource) {
            return this.dataSource.getHeaders.apply(this.dataSource, arguments);
        }
    },

    getProperty: function getProperty(propName) {
        if (propName in this) {
            return this[propName];
        }

        if (this.dataSource) {
            return getProperty.call(this.dataSource, propName);
        }
    },

    click: function() {
        if (this.dataSource) {
            return this.dataSource.click.apply(this.dataSource, arguments);
        }
    },

    findRow: function() {
        if (this.dataSource) {
            return this.dataSource.findRow.apply(this.dataSource, arguments);
        }
    },

    revealRow: function() {
        if (this.dataSource) {
            return this.dataSource.revealRow.apply(this.dataSource, arguments);
        }
    },

    /**
     * Get new object with name and index given the name or the index.
     * @param {string|number} [column] - Column name or index.
     * @param {string} [defaultName] - Name to use when column is omitted or undefined. May be omitted when column is definitely defined.
     * @returns {{name: string, index: number}}
     */
    getColumnInfo: function(column, defaultName) {
        var name, index;
        if (column === undefined) {
            column = defaultName;
        }
        if (typeof column === 'number') {
            name = this.getFields()[index = column];
        } else {
            index = this.getFields().indexOf(name = column);
        }
        if (name && index >= 0) {
            return {
                name: name,
                index: index
            };
        }
    },

    fixIndentForTableDisplay: function(string) {
        var count = string.search(/\S/);
        var end = string.substring(count);
        var result = Array(count + 1).join(this.replaceIndent) + end;
        return result;
    },

    dump: function(max) {
        max = Math.min(this.getRowCount(), max || Math.max(100, this.getRowCount()));
        var data = [];
        var fields = this.getHeaders();
        var cCount = this.getColumnCount();
        var viewMakesSense = this.viewMakesSense;
        for (var r = 0; r < max; r++) {
            var row = {};
            for (var c = 0; c < cCount; c++) {
                var val = this.getValue(c, r);
                if (c === 0 && viewMakesSense) {
                    val = this.fixIndentForTableDisplay(val);
                }
                row[fields[c]] = val;
            }
            data[r] = row;
        }
        console.table(data);
    }
};

module.exports = Base;
