'use strict';

var DataSource = require('./DataSource');
var stableSort = require('./stableSort.js');

var DataSourceSorter = DataSource.extend({
    initialize: function() {
        this.descendingSort = false;
    },

    prototype: {
        sortOn: function(colIdx, sortType) {
            if (sortType === 0) {
                this.clearIndex();
            } else {
                var self = this;
                this.buildIndex();
                stableSort(this.index, getValue, sortType);
            }

            function getValue(rowIdx) {
                return valueOrFunctionExecute(self.getUnfilteredValue(colIdx, rowIdx));
            }
        }
    }
});

function valueOrFunctionExecute(valueOrFunction) {
    var isFunction = ((typeof valueOrFunction)[0] === 'f');
    return isFunction ? valueOrFunction() : valueOrFunction;
}

module.exports = DataSourceSorter;