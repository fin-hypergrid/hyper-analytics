'use strict';

var JSDataSource = require('./JSDataSource');
var DataSorter = require('./DataSorter');
var DataFilter = require('./DataFilter');
var DataAggregator = require('./DataAggregator');
var aggregations = require('./aggregations');

module.exports = (function() {

    return {
        JSDataSource: JSDataSource,
        DataSorter: DataSorter,
        DataFilter: DataFilter,
        DataAggregator: DataAggregator,
        aggregations: aggregations
    };

})();
