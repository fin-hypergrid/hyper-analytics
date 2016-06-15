'use strict';

module.exports = {
    JSDataSource: require('./js/DataSource'),
    DataSourceSorter: require('./js/DataSourceSorter'),
    DataSourceSorterComposite: require('./js/DataSourceSorterComposite'),
    DataSourceGlobalFilter: require('./js/DataSourceGlobalFilter'),
    DataSourceAggregator: require('./js/DataSourceAggregator'),
    DataSourceTreeview: require('./js/DataSourceTreeview'),
    DataNodeGroupSorter: require('./js/DataNodeGroupSorter'),
    util: {
        aggregations: require('./js/util/aggregations'),
        Mappy: require('./js/util/Mappy'),
        stableSort: require('./js/util/stableSort'),
        headerify: require('./js/util/headerify'),
        generateSampleData: require('./generateSampleData.js')
    }
};
