'use strict';

var DataSourceSorterComposite = require('./DataSourceSorterComposite');
var DataSourceDepthSorter = require('./DataSourceDepthSorter');

/**
 * This data source should be positioned _ahead of_ (closer to the data than) `DataSourceTreeview`.
 * @constructor
 * @extends DataSourceIndexed
 */
var DataSourceTreeviewSorter = DataSourceSorterComposite.extend('DataSourceTreeviewSorter', {

    apply: function() {
        if (this.sorts.length) {
            var self = this,
                each = this.dataSource;

            for (var deepest = 0, rowIdx = this.getColumnCount() - 1; rowIdx >= 0; --rowIdx) {
                var depth = this.getRow(rowIdx).__DEPTH;
                if (depth > deepest) {
                    deepest = depth;
                }
            }

            this.sorts.forEach(function(sortSpec) {
                for (depth = deepest; depth >= 0; --depth) {
                    each = new DataSourceDepthSorter(each, self);
                    each.sortOn(sortSpec.columnIndex, sortSpec.direction, depth);
                }
            });

            this.last = each;
        } else {
            this.clearSorts();
        }
    }

});

module.exports = DataSourceTreeviewSorter;
