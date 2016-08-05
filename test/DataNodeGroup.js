var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
var sinon = require('sinon');
require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

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
                    object.children.should.be.an.instanceof(require('../src/js/util/Mappy'));
                });
            });
        });

        test.method('computeDepthString', 0, function() {
            object.depth = 0;
            /(   ){0}(▼|▶) key/.test(object.computeDepthString()).should.be.true();

            object.depth = 1;
            /(   ){1}(▼|▶) key/.test(object.computeDepthString()).should.be.true();

            object.depth = 2;
            /(   ){2}(▼|▶) key/.test(object.computeDepthString()).should.be.true();
        });

        describe('with 3 child nodes are added,', function() {
            var children, DEPTH;
            function NodeMock() {}
            NodeMock.prototype.toArray = sinon.stub();
            beforeEach(function() {
                children = [];
                object.children.set('Amy', children[0] = new NodeMock('amy'));
                object.children.set('Bob', children[1] = new NodeMock('bob'));
                object.children.set('Ann', children[2] = new NodeMock('ann'));
            });

            test.method('toArray', 1, function() {
                beforeEach(function() {
                    DEPTH = 2;
                    object.toArray(DEPTH);
                });
                it('sets `depth` to value of 1st arg', function() {
                    object.depth.should.equal(DEPTH);
                });
                it('calls `toArray` with depth + 1 on each child', function() {
                    DEPTH += 1;
                    with (NodeMock.prototype.toArray.getCall(0)) { calledWith(DEPTH); calledOn(children[0]); }
                    with (NodeMock.prototype.toArray.getCall(1)) { calledWith(DEPTH); calledOn(children[1]); }
                    with (NodeMock.prototype.toArray.getCall(2)) { calledWith(DEPTH); calledOn(children[2]); }
                });
                it('sets `data[0]` to result of calling `computeDepthString()`', function() {
                    object.data[0].should.equal(object.computeDepthString());
                });
            });
        });

        test.method('getIndex', 0);

        test.method('computeIndex', 0);

        test.method('toggleExpansionState', 1);

        test.method('getRowData', 1);

        test.method('buildView', 1);

        test.method('computeHeight', 0);
    });
};
