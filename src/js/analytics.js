'use strict';

var JSDataSource = require('./JSDataSource');
var DataSorter = require('./DataSorter');

module.exports = (function() {

    return {
        JSDataSource: JSDataSource,
        DataSorter: DataSorter
    };

})();