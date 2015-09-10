'use strict';

var JSDataSource = require('./JSDataSource');
var DataSorter = require('./DataSorter');
var DataFilter = require('./DataFilter');

module.exports = (function() {

    return {
        JSDataSource: JSDataSource,
        DataSorter: DataSorter,
        DataFilter: DataFilter,
    };

})();
