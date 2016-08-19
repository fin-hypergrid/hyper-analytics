'use strict';

var DataSourceSorterComposite = require('./DataSourceSorterComposite');
var DataSourceDepthSorter = require('./DataSourceDepthSorter');
var DataSourceSorter = require('./DataSourceSorter');

/**
 * @classdesc Should be positioned in the data source pipeline _ahead of_ (closer to the data than) `DataSourceTreeview`.
 * @constructor
 * @param dataSource
 * @extends DataSourceSorterComposite
 */
var DataSourceTreeviewSorter = DataSourceSorterComposite.extend('DataSourceTreeviewSorter', {

    /**
     * @summary Rebuild the index.
     * @memberOf DataSourceSorterComposite#
     */
    apply: function() {
        var each = this.dataSource,
            last, // last sort spec ("first" sort) when and only when joined AND it is the group column
            columnIndex, direction;

        if (this.sorts.length) {
            if (this.treeView.joined) {
                last = this.sorts[this.sorts.length - 1];
                last = last.columnIndex === this.treeView.groupColumn.index && last;
            }

            this.sorts.forEach(function(sortSpec) {
                if (sortSpec !== last) {
                    each = new DataSourceSorter(each);
                    each.sortOn(sortSpec.columnIndex, sortSpec.direction);
                }
            });
        }

        if (this.treeView.joined) {
            if (last) {
                columnIndex = last.columnIndex;
                direction = last.direction;
            } else {
                columnIndex = undefined;
                direction = 1;
            }

            // Finally, apply a "depth sort" to either the group column (if last) or the ID column to group it properly
            for (var depth = this.treeView.maxDepth; depth >= 0; --depth) {
                each = new DataSourceDepthSorter(each, this.treeView);
                each.sortOn(depth, direction, columnIndex);
            }
        }

        this.last = each;
    }

});

module.exports = DataSourceTreeviewSorter;
