var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
var sinon = require('sinon');
require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

var DataSource = require('../src/js/DataSource');

module.exports = function() {
    test.constructorModule('DataSourceAggregator', function(DataSourceAggregator) {
        var spy_SetAggregates = sinon.spy(DataSourceAggregator.prototype, 'setAggregates');
        var dataSource, DATA;
        beforeEach(function() {
            DATA = [
                { firstName: 'George', lastName: 'Washington', __rating: 5, inaugurated: 1789, 'term-ended': 1797 },
                { firstName: 'John',   lastName: 'Adams',      __rating: 4, inaugurated: 1797, 'term-ended': 1801 },
                { firstName: 'Thomas', lastName: 'Jefferson',  __rating: 4, inaugurated: 1801, 'term-ended': 1809 },
                { firstName: 'James',  lastName: 'Madison',    __rating: 2, inaugurated: 1809, 'term-ended': 1817 },
                { firstName: 'James',  lastName: 'Monroe',     __rating: 3, inaugurated: 1817, 'term-ended': 1825 }
            ];

            dataSource = new DataSource(DATA);
            object = new DataSourceAggregator(dataSource);
        });

        describe('initializes aggregates by calling `setAggregates()`', function() {
            it('called', function() {
                spy_SetAggregates.should.be.called();
            });
            describe('1st parameter', function() {
                var arg;
                beforeEach(function() {
                    arg = spy_SetAggregates.getCall(0).args[0]
                });
                it('is an object', function() {
                    arg.should.be.an.Object();
                });
                it('is empty plain object', function() {
                    Object.keys(arg).length.should.equal(0);
                });
            });
        });

        describe('returns a value that', function() {
            it('is an object', function() {
                object.should.be.an.Object();
            });

            test.property('dataSource', function() {
                it('is initialized to 1st arg to constructor', function() {
                    object.dataSource.should.equal(dataSource);
                });
                it('descends from `DataSource`', function() {
                    dataSource.should.be.instanceof(DataSource);
                });
            });

            test.property('index', function() {
                it('is initialized to an empty array', function() {
                    object.index.should.be.an.Array();
                    object.index.length.should.equal(0);
                });
            });

            test.property('aggregates', function() {
                it('is initialized to an empty array', function() {
                    object.aggregates.should.be.an.Array();
                    object.aggregates.length.should.equal(0);
                });
            });

            test.property('groupBys', function() {
                it('is initialized to an empty array', function() {
                    object.groupBys.should.be.an.Array();
                    object.groupBys.length.should.equal(0);
                });
            });

            test.property('view', function() {
                it('is initialized to an empty array', function() {
                    object.view.should.be.an.Array();
                    object.view.length.should.equal(0);
                });
            });

            test.property('sorterInstance', function() {
                it('is initialized to an empty plain object', function() {
                    object.sorterInstance.should.be.an.Object();
                    Object.keys(object.sorterInstance).length.should.equal(0);
                });
            });

            test.property('presortGroups', function() {
                it('is initialized to boolean `true`', function() {
                    object.presortGroups.should.be.an.Boolean();
                    object.presortGroups.should.be.true();
                });
            });

            test.method('setAggregates', 1, function() {
                it('TEST NEEDED!');
            });

            test.method('addAggregate', 2, function() {
                it('TEST NEEDED!');
            });

            test.method('setGroupBys', 1, function() {
                it('TEST NEEDED!');
            });

            test.method('addGroupBy', 1, function() {
                it('TEST NEEDED!');
            });

            test.method('hasGroups', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('hasAggregates', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('apply', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('clearGroups', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('clearAggregations', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('buildGroupTree', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('buildView', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('viewMakesSense', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('getValue', 2, function() {
                it('TEST NEEDED!');
            });

            test.method('setValue', 3, function() {
                it('TEST NEEDED!');
            });

            test.method('getColumnCount', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('getRowCount', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('click', 1, function() {
                it('TEST NEEDED!');
            });

            test.method('getHeaders', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('setHeaders', 1, function() {
                it('TEST NEEDED!');
            });

            test.method('getFields', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('setFields', 1, function() {
                it('TEST NEEDED!');
            });

            test.method('getGrandTotals', 0, function() {
                it('TEST NEEDED!');
            });

            test.method('getRow', 1, function() {
                it('TEST NEEDED!');
            });

            test.method('setData', 1, function() {
                it('TEST NEEDED!');
            });
        });
    });
}
