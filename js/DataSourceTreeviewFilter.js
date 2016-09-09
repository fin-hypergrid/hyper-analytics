'use strict';

var DataSourceGlobalFilter = require('./DataSourceGlobalFilter');

/**
 * @classdesc Should be positioned in the data source pipeline _ahead of_ (closer to the data than) the optional `DataSourceTreeviewSorter` and the required `DataSourceTreeview` (which sets `this.treeview`).
 * @constructor
 * @param dataSource
 * @extends DataSourceSorterComposite
 * @extends DataSourceGlobalFilter
 */
var DataSourceTreeviewFilter = DataSourceGlobalFilter.extend('DataSourceTreeviewFilter', {

    /**
     * @implements filterPredicate
     * @memberOf DataSourceGlobalFilter#
     */
    filterTest: function(r, rowObject) {
        return this.treeview.viewMakesSense() && rowObject.__EXPANDED !== undefined || this.filter.test(rowObject);
    }

});

module.exports = DataSourceTreeviewFilter;
