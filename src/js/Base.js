'use strict';

function Base() {}
Base.extend = require('extend-me');

Base.prototype.click = function(y) {
    if (this.dataSource) {
        this.dataSource.click(y);
    }
};

Base.prototype.replaceIndent = '____________________________________________________';

Base.prototype.fixIndentForTableDisplay = function(string) {
    var count = string.search(/\S/);
    var end = string.substring(count);
    var result = this.replaceIndent.substring(0, count) + end;
    return result;
};

Base.prototype.dump = function(max) {
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
};

module.exports = Base;
