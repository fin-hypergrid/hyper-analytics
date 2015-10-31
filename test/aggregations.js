var test = require('./util/test');

module.exports = function() {
    describe(test.module('aggregations'), function () {
        object = require('../src/js/aggregations');

        var group = {
            rows: [
                [4, 25, 66],
                [1, 22, 63],
                [7, 28, 69],
                [13, 54, 35],
                [10, 51, 32]
            ],
            getRowCount: function () {
                return group.rows.length;
            },
            getValue: function (c, r) {
                return group.rows[r][c];
            }
        };

        function isMetaMethodThatWhenMetaCalledReturnsResults(methodName, expectedResults, parms) {
            var method;
            beforeEach(function () {
                method = object[methodName];
            });
            test.method(methodName, 1, function () {
                describe('returns a value that', function () {
                    var func;
                    beforeEach(function () {
                        func = method(0);
                    });
                    it('is a function', function () {
                        func.should.be.a.Function();
                    });
                    describe('when called', function () {
                        it('takes a single parameter', function () {
                            func.length.should.equal(1);
                        });
                        describe('with a "group" object,', function () {
                            it('returns group\'s "' + methodName + '"', function () {
                                for (var columnIndex = group.rows[0].length; columnIndex--;) {
                                    var func = method(columnIndex);
                                    func(group).should.equal(expectedResults[columnIndex]);
                                }
                            });
                        });
                    });
                });
            });
        }

        test.itIsAnAPI();

        describe('has a member `count` that', function () {
            isMetaMethodThatWhenMetaCalledReturnsResults('count', [5, 5, 5]);
        });
        describe('has a member `sum` that', function () {
            isMetaMethodThatWhenMetaCalledReturnsResults('sum', [35, 180, 265]);
        });
        describe('has a member `min` that', function () {
            isMetaMethodThatWhenMetaCalledReturnsResults('min', [1, 22, 32]);
        });
        describe('has a member `max` that', function () {
            isMetaMethodThatWhenMetaCalledReturnsResults('max', [13, 54, 69]);
        });
        describe('has a member `avg` that', function () {
            isMetaMethodThatWhenMetaCalledReturnsResults('avg', [7, 36, 53]);
        });
        describe('has a member `first` that', function () {
            isMetaMethodThatWhenMetaCalledReturnsResults('first', [4, 25, 66]);
        });
        describe('has a member `last` that', function () {
            isMetaMethodThatWhenMetaCalledReturnsResults('last', [10, 51, 32]);
        });
        describe('has a member `stddev` that', function () {
            isMetaMethodThatWhenMetaCalledReturnsResults('stddev', [4.242640687119285, 13.638181696985855, 16.06237840420901]);
        });
        describe('remaining members:', function () {
            it('no untested properties', function () {
                properties.should.equal(0);
            });
            it('no untested methods', function () {
                methods.should.equal(0);
            });
        });
    });
}
