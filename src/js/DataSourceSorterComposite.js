'use strict';

var DataSource = require('./DataSource');
var DataSourceSorter = require('./DataSourceSorter');

var DataSourceSorterComposite = DataSource.extend({
    initialize: function() {
        this.sorts = [];
        this.last = this.data;
    },

    prototype: {
        sortOn: function(columnIndex, direction) {
            this.sorts.push([columnIndex, direction]);
        },

        applySorts: function() {
            var sorts = this.sorts;
            var each = this.dataSource;
            for (var i = 0; i < sorts.length; i++) {
                var sort = sorts[i];
                each = new DataSourceSorter(each);
                each.sortOn(sort[0], sort[1]);
            }
            this.last = each;
        },

        clearSorts: function() {
            this.sorts.length = 0;
            this.last = this.dataSource;
        },

        getValue: function(x, y) {
            return this.last.getValue(x, y);
        },

        setValue: function(x, y, value) {
            this.last.setValue(x, y, value);
        }
    }
});

module.exports = DataSourceSorterComposite;