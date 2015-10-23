'use strict';

/* global describe, it, beforeEach, afterEach */

require('should'); // extends `Object` (!) with `should`

describe('finanalytics module', function() {
    describe('has a module "aggregations" that', function() {
        var aggregations = require('../src/js/aggregations'),
            methods = 0,
            properties = 0;

        var group = {
            rows: [
                [ 4, 25, 66],
                [ 1, 22, 63],
                [ 7, 28, 69],
                [13, 54, 35],
                [10, 51, 32]
            ],
            getRowCount: function() {
                return group.rows.length;
            },
            getValue: function(c,r) {
                return group.rows[r][c];
            }
        };

        function isMetaMethodThatWhenMetaCalledReturnsResults(methodName, expectedResults) {
            it('is a method', function () {
                var isMethod = typeof aggregations[methodName] === 'function';
                methods -= isMethod;
                isMethod.should.be.true();
            });
            it('when called, returns a function', function () {
                aggregations[methodName](0).should.be.a.Function();
            });
            it('the returned function takes a single parameter', function () {
                aggregations[methodName](0).length.should.equal(1);
            });
            it('when the returned function is called with a "group" object, returns group\'s "' + methodName + '"', function() {
                for (var columnIndex = group.rows[0].length; columnIndex--; ) {
                    var func = aggregations[methodName](columnIndex);
                    func(group).should.equal(expectedResults[columnIndex]);
                }
            });
        }

        it('is an API', function() {
            // should be an object with method(s)
            aggregations.should.be.an.Object();
            Object.keys(aggregations).forEach(function(key) {
                var isMethod = typeof aggregations[key] === 'function';
                methods += isMethod;
                properties += !isMethod;
            });
            methods.should.not.equal(0);
        });
        describe('has a member `count` that', function() {
            isMetaMethodThatWhenMetaCalledReturnsResults('count', [5, 5, 5]);
        });
        describe('has a member `sum` that', function() {
            isMetaMethodThatWhenMetaCalledReturnsResults('sum', [35, 180, 265]);
        });
        describe('has a member `min` that', function() {
            isMetaMethodThatWhenMetaCalledReturnsResults('min', [1, 22, 32]);
        });
        describe('has a member `max` that', function() {
            isMetaMethodThatWhenMetaCalledReturnsResults('max', [13, 54, 69]);
        });
        describe('has a member `avg` that', function() {
            isMetaMethodThatWhenMetaCalledReturnsResults('avg', [7, 36, 53]);
        });
        describe('has a member `first` that', function() {
            isMetaMethodThatWhenMetaCalledReturnsResults('first', [4, 25, 66]);
        });
        describe('has a member `last` that', function() {
            isMetaMethodThatWhenMetaCalledReturnsResults('last', [10, 51, 32]);
        });
        describe('has a member `stddev` that', function() {
            isMetaMethodThatWhenMetaCalledReturnsResults('stddev', [4.242640687119285, 13.638181696985855, 16.06237840420901]);
        });
        describe('untested members:', function() {
            it('no properties', function() {
                methods.should.equal(0);
            });
            it('no methods', function() {
                methods.should.equal(0);
            });
        })
    })
});
