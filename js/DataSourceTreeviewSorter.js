'use strict';

var DataSourceSorterComposite = require('./DataSourceSorterComposite');
var DataSourceDepthSorter = require('./DataSourceDepthSorter');
var DataSourceSorter = require('./DataSourceSorter');

/**
 * @classdesc Should be positioned in the data source pipeline _ahead of_ (closer to the data than) the required `DataSourceTreeview` (which sets `this.treeview`) but _behind_ the optional `DataSourceTreeviewFilter`.
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
        var joined = this.treeview.viewMakesSense(),
            each = this.dataSource,
            last, // last sort spec ("first" sort) when and only when joined AND it is the group column
            lastIsGroup, columnIndex, direction;
        // get list of sorts from either API or use existing
        this.sorts = (this.sorter && this.sorter.prop('sorts')) || this.sorts;

        if (this.sorts.length) {
            if (joined) {
                last = this.sorts[this.sorts.length - 1];
                lastIsGroup = last.columnIndex === this.treeview.groupColumn.index;
            }

            this.sorts.forEach(function(sortSpec) {
                if (!(lastIsGroup && sortSpec === last)) {
                    each = new DataSourceSorter(each);
                    each.sortOn(sortSpec.columnIndex, sortSpec.direction);
                }
            });
        }

        if (joined) {
            if (lastIsGroup || this.sorts.length === 1) {
                columnIndex = last.columnIndex;
                direction = last.direction;
            } else {
                columnIndex = undefined;
                direction = 1;
            }

            // Finally, apply a "depth sort" to either the group column (if last) or the ID column to group it properly
            for (var depth = this.treeview.maxDepth; depth >= 0; --depth) {
                each = new DataSourceDepthSorter(each, this.treeview);
                each.sortOn(depth, direction, columnIndex);
            }
        }

        this.last = each;
    }

});

module.exports = DataSourceTreeviewSorter;
