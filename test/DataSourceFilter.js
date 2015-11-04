var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
var sinon = require('sinon');
require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

var DataSource = require('../src/js/DataSource');

module.exports = function() {
    test.constructorModule('DataSourceFilter', function (DataSourceFilter) {
        var DATA;
        beforeEach(function () {
            DATA = [
                [4, 25, 66],
                [1, 22, 63],
                [7, 28, 69],
                [13, 54, 35],
                [10, 51, 32]
            ];
            var dataSource = new DataSource(DATA);
            object = new DataSourceFilter(dataSource);
        });

        it('descends from DataSourceIndexed', function () {
            object.should.be.instanceof(require('../src/js/DataSourceIndexed'));
        });

        it('initializes `filters` to empty array', function () {
            object.filters.should.be.an.Array();
            object.filters.length.should.equal(0);
        });

        describe('HAS TWO SIMILAR METHODS', function () {
            [
                'add',
                'set'
            ].forEach(function (methodName) {
                test.method(methodName, 2, function () {
                    var index, filter;
                    beforeEach(function () {
                        index = [];
                        filter = function() {};
                        object[methodName](index, filter);
                    });

                    it('adds 1st first param (`columnIndex`) to 2nd param (object `filter`) as property `columnIndex`', function () {
                        filter.columnIndex.should.equal(index);
                    });
                    it('adds 2nd param (`filter`) to `filters` array', function () {
                        object.filters.indexOf(filter).should.be.greaterThanOrEqual(0);
                    });
                });
            });
        });

        test.method('clear', 0, function () {
            it('empties `filters`', function () {
                object.clear();
                object.filters.length.should.equal(0);
            });
            it('Calls `clearIndex`', function () {
                var spy = sinon.spy(object, 'clearIndex');
                object.clear();
                spy.should.be.called();
            });
        });

        test.method('apply', 0, function () {
            describe('when no defined filters', function () {
                it('calls `clearIndex`', function () {
                    var spy = sinon.spy(object, 'clearIndex');
                    object.apply();
                    spy.should.be.called();
                });
            });
            describe('when at least 1 defined filter, rebuilds the index:', function () {
                var stub, filterStubA, filterStubB, ROW_INDEX = 2;
                beforeEach(function() {
                    buildIndexStub = sinon.stub(object, 'buildIndex');
                    filterStubA = sinon.stub(); filterStubA.returns(true);
                    filterStubB = sinon.stub(); filterStubB.returns(true);
                    object.add(4, filterStubA);
                    object.add(1, filterStubB);
                    object.apply();
                });
                describe('calls `buildIndex`', function () {
                    it('called exactly once', function () {
                        buildIndexStub.should.be.calledOnce();
                    });
                    describe('with a single parameter that', function() {
                        var applyFilter;
                        beforeEach(function() {
                            applyFilter = buildIndexStub.getCall(0).args[0];
                        });
                        it('is the only parameter', function () {
                            buildIndexStub.getCall(0).args.length.should.equal(1);
                        });
                        it('is a co-routine', function () {
                            var arg = applyFilter.should.be.a.Function();
                        });
                        describe('that', function () {
                            it('takes 2 parameters', function () {
                                var arg = applyFilter.length.should.equal(2);
                            });
                            describe('when called for a given row', function() {
                                it('calls each filter in turn with (cell value, row object, row number)', function () {
                                    applyFilter.call(object, ROW_INDEX, DATA[ROW_INDEX]);
                                    filterStubA.calledWith(4, DATA[ROW_INDEX], ROW_INDEX);
                                    filterStubB.calledWith(1, DATA[ROW_INDEX], ROW_INDEX);
                                });
                                describe('returns', function() {
                                    it('`true` when all filters pass (return truthy)', function () {
                                        var results = applyFilter.call(object, 2, DATA[2]);
                                        results.should.be.true();
                                    });
                                    it('`false` when any filter fails (returns falsy)', function () {
                                        filterStubB.returns(false);
                                        var results = applyFilter.call(object, 2, DATA[2]);
                                        results.should.be.false();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

        test.method('getRowCount', 0, function () {
            describe('filtering is active so', function () {
                it('returns number of hits (which may be none)', function () {
                    object.filters.push(function () {});
                    object.index.push(3);
                    object.index.push(4);
                    object.getRowCount().should.equal(2);
                });
            });
            describe('filtering is inactive so', function () {
                it('return all rows', function () {
                    object.getRowCount().should.equal(DATA.length);
                });
            })
        });
    });
};
