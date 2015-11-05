var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
//var sinon = require('sinon');
//require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

module.exports = function() {
    test.constructorModule('DataNodeBase', function(DataNodeBase) {
        var KEY;
        beforeEach(function() {
            KEY = 'key';
            object = new DataNodeBase(KEY);
        });

        describe('returns a value that', function() {
            it('is an object', function() {
                object.should.be.an.Object();
            });

            test.property('label', function() {
                it('is initialized to 1st arg to constructor', function() {
                    object.label.should.equal(KEY);
                });
            });

            test.property('data', function() {
                it('is initialized to an single-element array', function() {
                    object.data.should.be.an.Array();
                    object.data.length.should.equal(1);
                });
                it('first element is an empty string', function() {
                    object.data[0].should.equal('');
                });
            });

            test.property('rowIndexes', function() {
                it('is initialized to an empty array', function() {
                    object.rowIndexes.should.be.an.Array();
                    object.rowIndexes.length.should.equal(0);
                });
            });

            test.property('hasChildren', function() {
                it('is initialized to boolean `false`', function() {
                    object.hasChildren.should.be.an.Boolean();
                    object.hasChildren.should.be.false();
                });
            });

            test.property('depth', function() {
                it('is initialized to the number `0`', function() {
                    object.depth.should.be.a.Number();
                    object.depth.should.be.equal(0);
                });
            });

            test.property('height', function() {
                it('is initialized to the number `1`', function() {
                    object.height.should.be.a.Number();
                    object.height.should.be.equal(1);
                });
            });

            test.property('expanded', function() {
                it('is initialized to boolean `false`', function() {
                    object.expanded.should.be.an.Boolean();
                    object.expanded.should.be.false();
                });
            });

            test.method('getValue', 1, function() {
                describe('TESTS', function() {
                    it('NEEDED!', function() {

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

            test.method('computeAggregates', 1, function() {
                describe('TESTS', function() {
                    it('NEEDED!', function() {

                    });
                });
            });

            test.method('applyAggregates', 1, function() {
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

            test.method('toggleExpansionState', 0, function() {
                describe('TESTS', function() {
                    it('NEEDED!', function() {

                    });
                });
            });
        });
    });
}
