var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
var sinon = require('sinon');
require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

var stableSort = require('../js/util/stableSort');
var DataSource = require('../js/DataSource');

module.exports = function() {
    test.constructorModule('DataSourceSorter', function(DataSourceSorter) {
        var DATA;
        beforeEach(function() {
            DATA = [
                [4, 25, 66],
                [1, 22, 63],
                [7, 28, 69],
                [13, 54, 35],
                [10, 51, 32]
            ];
            var dataSource = new DataSource(DATA);
            object = new DataSourceSorter(dataSource);
        });

        it('descends from `DataSourceIndexed`', function() {
            object.should.be.instanceof(require('../js/DataSourceIndexed'));
        });

        test.method('sortOn', 3, function() {
            describe('when 2nd parameter (`direction`) is 0', function() {
                it('clears the index by calling `clearIndex`', function() {
                    var spy = sinon.spy(object, 'clearIndex');
                    object.sortOn(2, 0);
                    spy.should.be.called();
                });
            });
            describe('when 2nd parameter (`direction`) is -1 or 1', function() {
                var colIdx = 2;
                describe('calls `stableSort`', function() {
                    var DIRECTION = 1;
                    var spy, spyCall;
                    beforeEach(function() {
                        spy = sinon.stub(stableSort, 'sort');
                        object.sortOn(colIdx, DIRECTION);
                        spy.restore();
                        spyCall = spy.getCall(0);
                    });
                    it('was called', function() {
                        spy.should.be.called();
                    });
                    describe('with 1st arg (`index`) that references an index that', function() {
                        var index;
                        beforeEach(function() {
                            index = spyCall.args[0];
                        });
                        it('is the current `index` array', function() {
                            index.should.equal(object.index);
                        });
                        it('has been rebuilt', function() {
                            should(index).deepEqual([0, 1, 2, 3, 4]);
                        });
                    });
                    describe('with 2nd arg (`getValue`) that', function() {
                        var getValue;
                        beforeEach(function() {
                            getValue = spyCall.args[1];
                        });
                        it('is a function', function() {
                            getValue.should.be.a.Function();
                        });
                        it('returns cell values verbatim when not functions', function() {
                            for (var i=DATA.length; i--;) {
                                getValue(i).should.equal(DATA[i][colIdx]);
                            }
                        });
                        it('returns result of executing functions found in cell value ', function() {
                            var ROW_INDEX = 0, MAGIC_NUMBER = 1717;
                            DATA[ROW_INDEX][colIdx] = function() { return MAGIC_NUMBER; };
                            getValue(ROW_INDEX).should.equal(MAGIC_NUMBER);
                        });
                    });
                    describe('with 3rd arg (`direction`) that', function() {
                        it('is given direction', function() {
                            var direction = spyCall.args[2];
                            direction.should.equal(DIRECTION);
                        });
                    });
                });
                describe('returns expected result in `index`', function() {
                    it('sorted ascending', function() {
                        object.sortOn(colIdx, 1);
                        should(object.index).deepEqual([4, 3, 1, 0, 2]);
                    });
                    it('sorted descending', function() {
                        object.sortOn(colIdx, -1);
                        should(object.index).deepEqual([2, 0, 1, 3, 4]);
                    });
                });
            });
        });
    });
};
