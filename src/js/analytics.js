'use strict';

var JSDataSource = require('./JSDataSource');
var DataSourceSorter = require('./DataSourceSorter');
var DataSourceFilter = require('./DataSourceFilter');
var DataAggregator = require('./DataAggregator');
var aggregations = require('./aggregations');

module.exports = (function() {

    return {
        JSDataSource: JSDataSource,
        DataSourceSorter: DataSourceSorter,
        DataSourceFilter: DataSourceFilter,
        DataAggregator: DataAggregator,
        aggregations: aggregations
    };

})();
