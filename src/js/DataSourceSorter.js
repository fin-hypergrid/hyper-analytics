'use strict';

var DataSource = require('./DataSource');
var stableSort = require('./stableSort.js');

var DataSourceSorter = DataSource.extend({
    initialize: function() {
        this.descendingSort = false; // TODO: this does not seem to be in use
    },

    prototype: {
        sortOn: function(colIdx, direction) {
            switch (direction) {
                case 0:
                    this.clearIndex();
                    break;

                case 1:
                case -1:
                    this.buildIndex();
                    var self = this;
                    stableSort.sort(this.index, getValue, direction);
                    break;

                default:
                    throw 'Unexpected sort direction value.';
            }

            function getValue(rowIdx) {
                return valOrFuncCall(self.getUnfilteredValue(colIdx, rowIdx));
            }
        }
    }
});

function valOrFuncCall(valOrFunc) {
    return typeof valOrFunc === 'function' ? valOrFunc() : valOrFunc;
}

module.exports = DataSourceSorter;