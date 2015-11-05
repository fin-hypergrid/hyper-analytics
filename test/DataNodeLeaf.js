var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
//var sinon = require('sinon');
//require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

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
            var DEPTH = 3;
            beforeEach(function() {
                object.prune(DEPTH);
            });
            test.property('depth', function() {
                it('is initialized to 1st arg of constructor', function() {
                    object.depth.should.equal(DEPTH);
                });
            });
            test.property('data', function() {
                describe('has an element [0] that', function() {
                    it('result of calling `computeDepthString()`', function() {
                        object.data[0].should.equal(object.computeDepthString());
                        object.data[0].should.equal('           key');
                    });
                });
            });
        });

        test.method('getAllRowIndexes', 0, function() {
            describe('TESTS', function() {
                it('NEEDED!', function() {

                });
            });
        });

        test.method('computeAggregates', 1, function() {
            describe('TESTS', function() {
                it('NEEDED!', function() {

                });
            });
        });

        test.method('buildView', 1, function() {
            describe('TESTS', function() {
                it('NEEDED!', function() {

                });
            });
        });

        test.method('computeHeight', 0, function() {
            describe('TESTS', function() {
                it('NEEDED!', function() {

                });
            });
        });
    });
};
