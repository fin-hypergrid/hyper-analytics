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
            it('TEST NEEDED!');
        });

        test.method('computeDepthString', 0, function() {
            it('TEST NEEDED!');
        });

        test.method('getIndex', 0, function() {
            it('TEST NEEDED!');
        });

        test.method('computeIndex', 0, function() {
            it('TEST NEEDED!');
        });

        test.method('toggleExpansionState', 1, function() {
            it('TEST NEEDED!');
        });

        test.method('computeAggregates', 1, function() {
            it('TEST NEEDED!');
        });

        test.method('buildView', 1, function() {
            it('TEST NEEDED!');
        });

        test.method('computeHeight', 0, function() {
            it('TEST NEEDED!');
        });
    });
};
