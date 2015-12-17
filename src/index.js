'use strict';

module.exports = {
    JSDataSource: require('./js/DataSource'),
    DataSourceSorter: require('./js/DataSourceSorter'),
    DataSourceSorterComposite: require('./js/DataSourceSorterComposite'),
    DataSourceFilter: require('./js/DataSourceFilter'),
    DataSourceGlobalFilter: require('./js/DataSourceGlobalFilter'),
    DataSourceAggregator: require('./js/DataSourceAggregator'),
    util: {
        aggregations: require('./js/util/aggregations'),
        aggregations: require('./js/util/Mappy'),
        aggregations: require('./js/util/stableSort')
    }
};
