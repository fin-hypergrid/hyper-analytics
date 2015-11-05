var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
var sinon = require('sinon');
require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

var DataSource = require('../src/js/DataSource');
var DataSourceSorter = require('../src/js/DataSourceSorter');

module.exports = function() {
    test.constructorModule('DataSourceSorterComposite', function(DataSourceSorterComposite) {
        var dataSource,  DATA;
        beforeEach(function() {
            DATA = [
                [10, 21, 766],
                [11, 35, 463],
                [11, 31, 969],
                [10, 22, 245],
                [10, 21, 542]
            ];
            dataSource = new DataSource(DATA);
            object = new DataSourceSorterComposite(dataSource);
        });

        it('descends from `DataSourceIndexed`', function() {
            object.should.be.an.instanceof(require('../src/js/DataSourceIndexed'));
        });

        test.property('dataSource', function() {
            it('is initialized to 1st arg to constructor (by underlying DataSourceIndexed initializer so we don\'t really need to check it here but whatever)', function() {
                object.dataSource.should.equal(dataSource);
            });
            it('descends from `DataSource`', function() {
                dataSource.should.be.instanceof(DataSource);
            });
        });

        test.property('last', true, function() {
            it('initialized to *private* `dataSource`', function() {
                object.last.should.equal(object.dataSource);
            });
        });

        test.property('sorts', true, function() {
            it('initialized to empty array', function() {
                object.sorts.should.be.an.Array();
                object.sorts.length.should.equal(0);
            });
        });

        describe('maintains a list of sort parameters in *private* `sorts`', function() {
            beforeEach(function() {
                object.sortOn(2, 1);
                object.sortOn(1, -1);
            });
            test.method('sortOn', 2, function() {
                it('builds a list', function() {
                    should(object.sorts).deepEqual([[2, 1], [1, -1]]);
                })
            });
            test.method('clearSorts', 0, function() {
                it('clears list', function() {
                    object.clearSorts();
                    object.sorts.length.should.equal(0);
                });
                it('resets `last` to `dataSource`', function() {
                    object.last = null; // already set to dataSource on initialization so step on it
                    object.clearSorts();
                    object.last.should.equal(object.dataSource);
                });
            });
        });

        test.method('applySorts', 0, function() {
            describe('when no defined sorts', function() {
                it('sets *private* `last` to `dataSource`', function() {
                    object.last = null; // already set to dataSource on initialization so step on it
                    object.applySorts();
                    object.last.should.equal(object.dataSource);
                });
            });
            describe('when a single sort is defined', function() {
                var dataSourceSorter, EXPECTED_INDEX = [3, 1, 4, 0, 2];
                beforeEach(function() {
                    object.sortOn(2, 1); // 3rd column, ascending
                    object.applySorts();
                    dataSourceSorter = object.last;
                });

                test.method('getValue', 2, function() {
                    it('returns correct data', function() {
                        object.getValue(2,0).should.equal(245);
                        object.getValue(2,1).should.equal(463);
                        object.getValue(2,2).should.equal(542);
                        object.getValue(2,3).should.equal(766);
                        object.getValue(2,4).should.equal(969);
                    });
                });

                test.method('setValue', 3, function() {
                    it('sets data correctly', function() {
                        object.setValue(2, 0, 2450);
                        object.dataSource.data[3][2].should.equal(2450);
                        object.getValue(2,0).should.equal(2450);
                        // other values untouched:
                        object.getValue(2,1).should.equal(463);
                        object.getValue(2,2).should.equal(542);
                        object.getValue(2,3).should.equal(766);
                        object.getValue(2,4).should.equal(969);
                    });
                });

                describe('internally a new sorter is instantiated that', function() {
                    it('sets *private* `last` to a `DataSourceSorter`', function() {
                        dataSourceSorter.should.be.an.instanceof(DataSourceSorter);
                    });
                    it('data source is a `DataSource`', function() {
                        dataSourceSorter.dataSource.should.be.an.instanceof(DataSource);
                    });
                    it('data source is `dataSource`', function() {
                        dataSourceSorter.dataSource.should.equal(object.dataSource);
                    });
                    it('data source `index` is correctly stable sorted', function() {
                        should(dataSourceSorter.index).deepEqual(EXPECTED_INDEX);
                    });
                });
            });

            describe('when 2 sorts are defined', function() {
                var LOW_ORDER_INDEX = [0, 4, 3, 2, 1]; // on 2nd column ascending: 10:21:766, 10:21:542, 10:22:245, 11:31:969, 11:35:463
                var HIGH_ORDER_INDEX = [3, 4, 0, 1, 2]; // on 1st column descending: 11:31:969, 11:35:463, 10:21:766, 10:21:542, 10:22:245

                beforeEach(function() {
                    object.sortOn(1, 1); // low-order sort comes last: 2nd column, ascending
                    object.sortOn(0, -1); // high-order sort comes first: 1st column, descending
                    object.applySorts();
                });

                it('`getValue()` returns correct data', function() {
                    object.getValue(2,0).should.equal(969);
                    object.getValue(2,1).should.equal(463);
                    object.getValue(2,2).should.equal(766);
                    object.getValue(2,3).should.equal(542);
                    object.getValue(2,4).should.equal(245);
                });

                test.method('setValue', 3, function() {
                    it('sets data correctly', function() {
                        object.setValue(2, 0, 2450);
                        object.dataSource.data[LOW_ORDER_INDEX[HIGH_ORDER_INDEX[0]]][2].should.equal(2450);
                        object.getValue(2,0).should.equal(2450);
                        // other values untouched:
                        object.getValue(2,1).should.equal(463);
                        object.getValue(2,2).should.equal(766);
                        object.getValue(2,3).should.equal(542);
                        object.getValue(2,4).should.equal(245);
                    });
                });

                describe('internally 2 new sorters are instantiated:', function() {
                    var lowOrderSort, highOrderSort;

                    beforeEach(function() {
                        highOrderSort = object.last; // this sort was done last
                        lowOrderSort = highOrderSort.dataSource; // this sort was done first
                    });

                    it('sets *private* `last` to a `DataSourceSorter`', function() {
                        highOrderSort.should.be.an.instanceof(DataSourceSorter);
                    });
                    it('the index is correctly stable sorted', function() {
                        should(highOrderSort.index).deepEqual(HIGH_ORDER_INDEX);
                    });
                    it('*private* `last`\'s data source is another `DataSourceSorter`', function() {
                        lowOrderSort.should.be.an.instanceof(DataSourceSorter);
                    });
                    it('the other data source\'s data source is a `DataSource`', function() {
                        lowOrderSort.dataSource.should.be.an.instanceof(DataSource);
                    });
                    it('the other data source\'s data source is `dataSource`', function() {
                        lowOrderSort.dataSource.should.equal(object.dataSource);
                    });
                    it('the other data source\'s `index` is correctly stable sorted', function() {
                        should(lowOrderSort.index).deepEqual(LOW_ORDER_INDEX);
                    });
                });
            });
        });
    });
};
