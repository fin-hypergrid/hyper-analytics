var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
var sinon = require('sinon');
require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

module.exports = function() {
    test.constructorModule('DataNodeLeaf', function(DataNodeLeaf) {
        var KEY;
        beforeEach(function() {
            KEY = 'key';
            object = new DataNodeLeaf(KEY);
        });

        it('descends from `DataNodeBase`', function() {
            object.should.be.an.instanceof(require('../src/js/DataNodeBase'));
        });

        test.method('prune', 1, function() {
            var DEPTH = 3, spy_computeDepthString;
            beforeEach(function() {
                spy_computeDepthString = sinon.spy(object, 'computeDepthString');
                object.prune(DEPTH);
            });
            test.property('depth', function() {
                it('is initialized to 1st arg of constructor', function() {
                    object.depth.should.equal(DEPTH);
                });
            });
            test.property('data', function() {
                describe('has an element [0] that', function() {
                    it('is derived by calling `computeDepthString()` (inherited from DataNodeBase)', function() {
                        spy_computeDepthString.should.be.called();
                    });
                    it('consists of spaces + key', function() {
                        (new RegExp('^ +' + KEY + '$')).test(object.data[0]).should.be.true();
                    });
                });
            });
        });

        test.method('getIndex', 0, function() {
            describe('returns an object that', function() {
                var value;
                beforeEach(function() {
                    value = object.getIndex();
                });
                it('is an array', function() {
                    value.should.be.an.Array();
                });
                it('returns `index`', function() {
                    value.should.equal(object.index);
                });
            });
        });

        test.method('buildView', 1, function() {
            it('adds self to given aggregator\'s view', function() {
                var aggregator = { addView: sinon.spy() };
                object.buildView(aggregator);
                aggregator.addView.should.be.calledWith(object);
            });
        });

        test.method('computeHeight', 0, function() {
            describe('returns an object that', function() {
                var value;
                beforeEach(function() {
                    value = object.computeHeight();
                });
                it('is a number', function() {
                    value.should.be.a.Number();
                });
                it('returns the number `1`', function() {
                    value.should.equal(1);
                });
            });
        });
    });
};
