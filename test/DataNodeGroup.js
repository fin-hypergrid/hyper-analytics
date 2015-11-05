var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
//var sinon = require('sinon');
//require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

module.exports = function() {
    test.constructorModule('DataNodeGroup', true, function(DataNodeGroup) {
        var KEY;
        beforeEach(function() {
            KEY = 'key';
            object = new DataNodeGroup(KEY);
        });

        it('descends from `DataNodeBase`', function() {
            object.should.be.an.instanceof(require('../src/js/DataNodeBase'));
        });

        test.method('initialize', 1, function() {
            test.property('children', function() {
                it('is initialized to an instance of `Map`', function() {
                    object.children.should.be.an.instanceof(require('../src/js/util/Map'));
                });
            });
        });

        test.method('prune', 1, function() {
            describe('TESTS', function() {
                it('NEEDED!', function() {

                });
            });
        });

        test.method('computeDepthString', 0, function() {
            describe('TESTS', function() {
                it('NEEDED!', function() {

                });
            });
        });

        test.method('getAllRowIndexes', 0, function() {
            describe('TESTS', function() {
                it('NEEDED!', function() {

                });
            });
        });

        test.method('computeAllRowIndexes', 0, function() {
            describe('TESTS', function() {
                it('NEEDED!', function() {

                });
            });
        });

        test.method('toggleExpansionState', 1, function() {
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
