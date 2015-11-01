// finanalytics unit tests
// Jonathan Eiten, 10/2015

var test = require('./util/test');
//var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
//var sinon = require('sinon');
//require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

var moduleNames = [
    //'aggregations',
    //'stableSort',
    //'DataSource',
    //'DataSourceFilter',
    'DataSourceSorter',
];

moduleNames.forEach(function(moduleName) {
    require('./' + moduleName)();
});
