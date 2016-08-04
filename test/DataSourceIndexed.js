var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`

var DataSource = require('../js/DataSource');

var INDEX_VECTOR = [ 0, 1, 2, 3, 4 ],
    INVERSE_VECTOR = [ 4, 3, 2, 1, 0];

module.exports = function() {
    test.constructorModule('DataSourceIndexed', true, function(DataSourceIndexed) {
        var dataSource, DATA, DATA_MAX;
        beforeEach(function() {
            DATA = [
                { firstName: 'George', lastName: 'Washington', __rating: 5, inaugurated: 1789, 'term-ended': 1797 },
                { firstName: 'John',   lastName: 'Adams',      __rating: 4, inaugurated: 1797, 'term-ended': 1801 },
                { firstName: 'Thomas', lastName: 'Jefferson',  __rating: 4, inaugurated: 1801, 'term-ended': 1809 },
                { firstName: 'James',  lastName: 'Madison',    __rating: 2, inaugurated: 1809, 'term-ended': 1817 },
                { firstName: 'James',  lastName: 'Monroe',     __rating: 3, inaugurated: 1817, 'term-ended': 1825 }
            ];
            DATA_MAX = DATA.length - 1;

            dataSource = new DataSource(DATA);
            object = new DataSourceIndexed(dataSource);
        });

        describe('returns a value that', function() {
            it('is an object', function() {
                object.should.be.an.Object();
            });

            test.property('dataSource', function() {
                it('is initialized to 1st arg of constructor', function() {
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

            test.method('getRowCount', 0, function() {
                describe('without index vector', function() {
                    it('returns the correct number of rows in the data', function() {
                        object.getRowCount().should.equal(DATA.length);
                    });
                });
                describe('with index vector', function() {
                    it('returns correct number of rows in the data', function() {
                        object.index = [ 1, 2, 3 ];
                        for (var i = DATA.length; i--;) {
                            object.getRowCount().should.not.equal(DATA.length);
                        }
                    });
                });
            });

            test.method('getRow', 1, function() {
                describe('without index vector', function() {
                    it('returns correct row of data', function() {
                        for (var i = DATA.length; i--;) {
                            object.getRow(i).should.equal(DATA[i]);
                        }
                    });
                });
                describe('with default "identity" index vector', function() {
                    it('returns correct row of data', function() {
                        for (var i = DATA.length; i--;) {
                            object.getRow(i).should.equal(DATA[i]);
                        }
                    });
                });
                describe('with reversed index vector', function() {
                    it('returns correct row of data', function() {
                        object.index = INVERSE_VECTOR;
                        for (var i = DATA.length; i--;) {
                            object.getRow(i).should.equal(DATA[DATA_MAX - i]);
                        }
                    });
                });
            });

            test.method('getValue', 2, function() {
                var altFields = ['inaugurated', 'term-ended', 'lastName', 'firstName'];

                it('returns `null` for non-existent row', function() {
                    should(object.getValue(3, 9)).equal(null);
                });
                describe('without index vector', function() {
                    it('returns correct data', function() {
                        object.setFields(altFields);
                        // spot check one field for each row:
                        object.getValue(3, 0).should.equal(DATA[0].firstName);
                        object.getValue(2, 1).should.equal(DATA[1].lastName);
                        object.getValue(0, 2).should.equal(DATA[2].inaugurated);
                        object.getValue(1, 3).should.equal(DATA[3]['term-ended']);
                        object.getValue(3, 4).should.equal(DATA[4].firstName);
                    });
                });
                describe('with reversed index vector', function() {
                    it('returns correct data', function() {
                        object.index = INVERSE_VECTOR;
                        object.setFields(altFields);
                        // spot check one field for each row:
                        object.getValue(3, 0).should.equal(DATA[DATA_MAX - 0].firstName);
                        object.getValue(2, 1).should.equal(DATA[DATA_MAX - 1].lastName);
                        object.getValue(0, 2).should.equal(DATA[DATA_MAX - 2].inaugurated);
                        object.getValue(1, 3).should.equal(DATA[DATA_MAX - 3]['term-ended']);
                        object.getValue(3, 4).should.equal(DATA[DATA_MAX - 4].firstName);
                    });
                });
            });

            test.method('setValue', 3, function() {
                describe('without index vector', function() {
                    it('sets correct cells', function() {
                        object.setFields(['lastName', 'firstName']);
                        object.setValue(0, 3, 'Carter');
                        object.setValue(1, 3, 'Jimmy');
                        should(DATA[3]).deepEqual({
                            firstName: 'Jimmy',
                            lastName: 'Carter',
                            __rating: 2,
                            inaugurated: 1809,
                            'term-ended': 1817
                        });
                    });
                });
                describe('with reversed index vector', function() {
                    it('sets correct cells', function() {
                        object.index = INVERSE_VECTOR;
                        object.setFields(['lastName', 'firstName']);
                        object.setValue(0, 3, 'Carter');
                        object.setValue(1, 3, 'Jimmy');
                        should(DATA[DATA_MAX - 3]).deepEqual({
                            firstName: 'Jimmy',
                            lastName: 'Carter',
                            __rating: 4,
                            inaugurated: 1797,
                            'term-ended': 1801
                        });
                    });
                });
            });

            test.method('clearIndex', 0, function() {
                it('maintains same `index` array as originally set by constructor', function() {
                    var index = object.index;
                    object.clearIndex();
                    object.index.should.equal(index);
                });
                it('empties `index` array', function() {
                    object.index = [2, 4];
                    object.index.length.should.not.equal(0);
                    object.clearIndex();
                    object.index.length.should.equal(0);
                });
            });

            test.method('buildIndex', 1, function() {
                describe('with no parameters', function() {
                    it('sets `index` to initial state', function() {
                        object.buildIndex();
                        should(object.index).deepEqual(INDEX_VECTOR);
                    });
                });
            describe('with single parameter (`predicate`),', function() {
                    it('predicate is called with expected parameters', function() {
                        var dump = [];
                        function predicate(r, rowObject) {
                            dump[r] = rowObject;
                        }
                        object.buildIndex(predicate);
                        should(dump).deepEqual(DATA);
                    });
                    it('sets `index` correctly using a predicate', function() {
                        function oddRowsOnly(r, rowObject) {
                            return r & 1;
                        }
                        object.buildIndex(oddRowsOnly);
                        should(object.index).deepEqual([1, 3]);
                    });
                });
            });
        });
    });
}
