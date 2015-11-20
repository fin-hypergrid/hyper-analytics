var test = require('./util/test');

module.exports = function() {
    test.module('aggregations', function() {
        object = require('../src/js/util/aggregations');

        var group = {
            rows: [
                [4, 25, 66],
                [1, 22, 63],
                [7, 28, 69],
                [13, 54, 35],
                [10, 51, 32]
            ],
            getRowCount: function() {
                return group.rows.length;
            },
            getValue: function(c, r) {
                return group.rows[r][c];
            }
        };

        function isMetaMethodThatWhenMetaCalledReturnsResults(methodName, expectedResults, parms) {
            var method;
            beforeEach(function() {
                method = object[methodName];
            });
            test.method(methodName, 1, function() {
                describe('returns a value that', function() {
                    var func;
                    beforeEach(function() {
                        func = method(0);
                    });
                    it('is a function', function() {
                        func.should.be.a.Function();
                    });
                    describe('when called', function() {
                        it('takes a single parameter', function() {
                            func.length.should.equal(1);
                        });
                        describe('with a "group" object,', function() {
                            it('returns group\'s "' + methodName + '"', function() {
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

        isMetaMethodThatWhenMetaCalledReturnsResults('count', [5, 5, 5]);
        isMetaMethodThatWhenMetaCalledReturnsResults('sum', [35, 180, 265]);
        isMetaMethodThatWhenMetaCalledReturnsResults('min', [1, 22, 32]);
        isMetaMethodThatWhenMetaCalledReturnsResults('max', [13, 54, 69]);
        isMetaMethodThatWhenMetaCalledReturnsResults('avg', [7, 36, 53]);
        isMetaMethodThatWhenMetaCalledReturnsResults('first', [4, 25, 66]);
        isMetaMethodThatWhenMetaCalledReturnsResults('last', [10, 51, 32]);
        isMetaMethodThatWhenMetaCalledReturnsResults('stddev', [4.242640687119285, 13.638181696985855, 16.06237840420901]);
    });
};
