var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
var sinon = require('sinon');
require('should-sinon');

var stableSort = require('../src/js/stableSort');

module.exports = function() {
    test.constructorModule('DataSourceSorter', function (DataSourceSorter) {
        var DATA;
        beforeEach(function () {
            DATA = [
                [4, 25, 66],
                [1, 22, 63],
                [7, 28, 69],
                [13, 54, 35],
                [10, 51, 32]
            ];
            object = new DataSourceSorter(DATA);
        });

        it('descends from DataSource', function () {
            object.should.be.instanceof(require('../src/js/DataSource'));
        });

        // TODO: descendingSort does not seem to be in use anywhere
        test.property('descendingSort', function() {
            it('initialized to `false`', function () {
                object.descendingSort.should.false();
            });
        });

        test.method('sortOn', 2, function () {
            describe('when 2nd parameter (`direction`) is 0', function() {
                it('clears the index', function () {
                    var spy = sinon.spy(object, 'clearIndex');
                    object.sortOn(2, 0);
                    spy.should.be.called();
                });
            });
            describe('when 2nd parameter (`direction`) is -1 or 1', function () {
                var colIdx = 2;
                describe('returns expected result in index', function() {
                    it('sorted ascending', function() {
                        object.sortOn(colIdx, 1);
                        should(object.index).deepEqual([4, 3, 1, 0, 2]);
                    });
                    it('sorted descending', function() {
                        object.sortOn(colIdx, -1);
                        should(object.index).deepEqual([2, 0, 1, 3, 4]);
                    });
                });
                describe('calls `stableSort`', function() {
                    var spy, spyCall, direction;
                    beforeEach(function() {
                        direction = 1;
                        spy = sinon.stub(stableSort, 'sort');
                        object.sortOn(colIdx, direction);
                        spy.restore();
                        spyCall = spy.getCall(0);
                    });
                    it('was called', function() {
                        spy.should.be.called();
                    });
                    describe('with 1st arg (`index`) that', function() {
                        it('is the current index', function() {
                            spyCall.args[0].should.equal(object.index);
                        });
                        it('has been rebuilt', function() {
                            should(spyCall.args[0]).deepEqual([0, 1, 2, 3, 4]);
                        });
                    });
                    describe('with 2nd arg (`getValue`) as function that', function() {
                        it('returns column values', function() {
                            var func = spyCall.args[1];
                            func.should.be.a.Function();
                            for (var i=DATA.length; i--;) {
                                func(i).should.equal(DATA[i][colIdx]);
                            }
                        });
                        it('returns executed column functions', function() {
                            var func = spyCall.args[1];
                            DATA[0][colIdx] = function() { return 1717; };
                            func(0).should.equal(1717);
                        });
                    });
                    describe('with 3rd arg (`direction`) that', function() {
                        it('is given direction', function() {
                            spyCall.args[2].should.equal(direction);
                        });
                    });
                });
            });
        });
    });
};
