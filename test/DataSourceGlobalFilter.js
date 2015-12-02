var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
var sinon = require('sinon');
require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

var DataSource = require('../src/js/DataSource');

module.exports = function() {
    test.constructorModule('DataSourceGlobalFilter', function(DataSourceGlobalFilter) {
        var DATA;
        beforeEach(function() {
            DATA = [
                [4, 25, 66, 95],
                [1, 22, 63, 82],
                [7, 28, 69, 85],
                [13, 54, 35, 77],
                [10, 51, 32, 99]
            ];
            var dataSource = new DataSource(DATA);
            object = new DataSourceGlobalFilter(dataSource);
        });

        it('descends from `DataSourceIndexed`', function() {
            object.should.be.instanceof(require('../src/js/DataSourceIndexed'));
        });

        test.method('set', 1, function() {
            it('sets instance var `filter` to 2nd param (`filter`)', function() {
                var filter = {};
                object.set(filter);
                object.filter.should.equal(filter);
            });
        });

        test.method('clear', 0, function() {
            beforeEach(function() {
                object.clear();
            });
            it('undefines `filter`', function() {
                should(object.filter).equal(undefined);
            });
            it('Calls `clearIndex`', function() {
                var spy = sinon.spy(object, 'clearIndex');
                object.clear();
                spy.should.be.called();
            })
        });

        test.method('apply', 1, function() {
            var visibleColumns;
            beforeEach(function() {
                visibleColumns = [{ index: 1 }, { index: 3 }];
            });
            describe('when global filter is not defined', function() {
                it('calls `clearIndex`', function() {
                    var spy = sinon.spy(object, 'clearIndex');
                    object.apply(visibleColumns);
                    spy.should.be.called();
                });
            });
            describe('when global filter is defined, rebuilds the index:', function() {
                var stub, filterStub,
                    ROW_INDEX = 4;
                beforeEach(function() {
                    stub = sinon.stub(object, 'buildIndex');
                    filterStub = sinon.stub();
                    filterStub.onCall(0).returns(false);
                    filterStub.onCall(1).returns(true); // stop filtering at 2nd column (columnIndex === 2 as per setFields below)
                    filterStub.onCall(2).returns(true);

                    object.setFields([0, 2, 3]); // skip columnIndex === 1
                    object.set(filterStub);
                });
                describe('calls `buildIndex`', function() {
                    it('called exactly once', function() {
                        object.apply(visibleColumns);
                        stub.should.be.calledOnce();
                    });
                    describe('with a single parameter that', function() {
                        var applyFilter;
                        beforeEach(function() {
                            object.apply(visibleColumns);
                            applyFilter = stub.getCall(0).args[0];
                        });
                        it('is the only parameter', function() {
                            stub.getCall(0).args.length.should.equal(1);
                        });
                        it('is a co-routine', function() {
                            var arg = applyFilter.should.be.a.Function();
                        });
                        describe('that', function() {
                            it('takes 2 parameters', function() {
                                var arg = applyFilter.length.should.equal(2);
                            });
                            describe('when called for a given row', function() {
                                describe('applies given `filter` to each column in `object.fields`', function() {
                                    beforeEach(function() {
                                        applyFilter.call(object, ROW_INDEX, DATA[ROW_INDEX]);
                                    });
                                    it('exactly twice (because 2nd filter stub returns `true`)', function() {
                                        filterStub.calledTwice;
                                    });
                                    it('with (cell value, row object, row number)', function() {
                                        filterStub.getCall(0).calledWith(0, DATA[ROW_INDEX], ROW_INDEX);
                                        filterStub.getCall(1).calledWith(2, DATA[ROW_INDEX], ROW_INDEX);
                                    });
                                });
                            });
                            describe('returns', function() {
                                it('`false` when filter falsy for all columns', function() {
                                    filterStub.onCall(1).returns(false);
                                    filterStub.onCall(2).returns(false);
                                    object.apply(visibleColumns);
                                    stub.returns(false);
                                });
                                it('`true` when filter when returns truthy for any column', function() {
                                    object.apply(visibleColumns);
                                    stub.returns(true);
                                });
                            });
                        });
                    });
                });
            });
        });

        test.method('getRowCount', 0, function() {
            describe('filtering is active so', function() {
                it('returns number of hits (which may be none)', function() {
                    object.set(function() {});
                    object.index.push(3);
                    object.index.push(4);
                    object.getRowCount().should.equal(2);
                });
            });
            describe('filtering is inactive so', function() {
                it('returns all rows', function() {
                    object.getRowCount().should.equal(DATA.length);
                });
            });
        });
    });
};
