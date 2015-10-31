// finanalytics unit tests
// Jonathan Eiten, 10/2015

var test = require('./util/test');
//var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
//var sinon = require('sinon');
//require('should-sinon');

require('./aggregations')();
require('./stableSort')();
require('./DataSource')();
require('./DataSourceFilter')();
