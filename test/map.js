var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
var sinon = require('sinon');
require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

module.exports = function() {
    test.constructorModule('util/Mappy', function(Mappy) {
        beforeEach(function() {
            object = new Mappy();
        });

        describe('returns a value that', function() {
            it('is an object', function() {
                object.should.be.an.Object();
            });
        });

        describe('BEFORE ADDING ANY DATA', function() {
            test.property('data', function() {
                it('is initialized to an empty plain object', function() {
                    object.data.should.be.an.Object();
                    Object.getOwnPropertyNames(object.data).length.should.equal(0);
                });
            });

            test.property('keys', function() {
                it('is initialized to an empty array', function() {
                    object.keys.should.be.an.Array();
                    object.keys.length.should.equal(0);
                });
            });

            test.property('values', function() {
                it('is initialized to an empty array', function() {
                    object.values.should.be.an.Array();
                    object.values.length.should.equal(0);
                });
            });

            test.method('getIfAbsent', 2, function() {
                it('returns value from `ifAbsentFunc()`', function() {
                    var KEY = 'abc', VALUE = 789;
                    function ifAbsentFunc(key, context) {
                        return VALUE;
                    };
                    object.getIfAbsent(KEY, ifAbsentFunc).should.equal(VALUE);
                });
            });
        });

        describe('AFTER ADDING SOME DATA', function() {
            var KEY = 'abc', ALT_KEY = 'def', VALUE = 345, ALT_VALUE = 789;
            beforeEach(function() {
                object.set(KEY, VALUE);
            });

            test.method('set', 2, function() {
                it('there is a single key in the store', function() {
                    object.keys.length.should.equal(1);
                    Object.keys(object.data).length.should.equal(1);
                });
                it('stores the key', function() {
                    object.keys[0].should.equal(KEY);
                });
                it('adds the value to the data object', function() {
                    object.data[Object.keys(object.data)[0]].should.equal(VALUE);
                });
                describe('when called again with same key but different value', function() {
                    beforeEach(function() {
                        object.set(KEY, ALT_VALUE);
                    });
                    it('there is still only a single key in the store', function() {
                        object.keys.length.should.equal(1);
                        Object.keys(object.data).length.should.equal(1);
                    });
                    it('the stored value has been updated', function() {
                        object.data[Object.keys(object.data)[0]].should.equal(ALT_VALUE);
                    });
                });
                describe('when called again with a different key', function() {
                    beforeEach(function() {
                        object.set(ALT_KEY, ALT_VALUE);
                    });
                    it('there are now two keys in the store', function() {
                        object.keys.length.should.equal(2);
                        Object.keys(object.data).length.should.equal(2);
                    });
                    it('both values are now in the store', function() {
                        var values = [];
                        values.push(object.data[Object.keys(object.data)[0]]);
                        values.push(object.data[Object.keys(object.data)[1]]);
                        values.indexOf(VALUE).should.be.not.equal(-1);
                        values.indexOf(ALT_VALUE).should.be.not.equal(-1);
                    });
                });
            });

            test.method('get', 1, function() {
                it('returns the data associated with the key', function() {
                    object.get(KEY).should.equal(VALUE);
                })
            });

            test.method('getIfAbsent', 2, function() {
                var called;
                function ifAbsentFunc(key, context) {
                    called = true;
                    return 789;
                }
                beforeEach(function() {
                    called = false;
                });
                it('ignores `ifAbsentFunc`', function() {
                    object.getIfAbsent(KEY, ifAbsentFunc);
                    called.should.be.false();
                });
                it('returns value from `data`', function() {
                    object.getIfAbsent(KEY, ifAbsentFunc).should.equal(VALUE);
                });
            });

            test.method('size', 0, function() {
                it('returns the number of unique keys added', function() {
                    object.size().should.equal(1);

                    // update existing value
                    object.set(KEY, ALT_VALUE);
                    object.size().should.equal(1);

                    // add a new key for a total of 2
                    object.set('xyz', 23423);
                    object.size().should.equal(2);
                });
            });

            test.method('clear', 0, function() {
                it('empties the store', function() {
                    object.keys.length.should.not.equal(0);
                    Object.keys(object.data).length.should.not.equal(0);

                    object.clear();

                    object.keys.length.should.equal(0);
                    Object.keys(object.data).length.should.equal(0);
                });
            });

            test.method('delete', 1, function() {
                beforeEach(function() {
                    object.set(ALT_KEY, ALT_VALUE);
                });
                describe('with known key', function() {
                    it('removes one key', function() {
                        object.delete(KEY);
                        object.keys.length.should.equal(1);
                    });
                });
                describe('with unknown key', function() {
                    it('fails silently', function() {
                        object.delete('xyz');
                        object.keys.length.should.equal(2);
                    });
                });
            });

            test.method('forEach', 1, function() {
                it('calls a iteratee function with 3 args', function() {
                    var stub_iteratee = sinon.stub();
                    object.set(ALT_KEY, ALT_VALUE);
                    object.map(stub_iteratee);
                    stub_iteratee.callCount.should.equal(2);
                    stub_iteratee.getCall(0).calledWithExactly(VALUE, KEY, object);
                    stub_iteratee.getCall(1).calledWithExactly(ALT_VALUE, ALT_KEY, object);
                });
            });

            test.method('map', 1, function() {
                it('calls a transform function with 3 args', function() {
                    var stub_transform = sinon.stub();
                    object.set(ALT_KEY, ALT_VALUE);
                    object.map(stub_transform);
                    stub_transform.getCall(0).calledWithExactly(VALUE, KEY, object);
                    stub_transform.getCall(1).calledWithExactly(ALT_VALUE, ALT_KEY, object);
                });
                it('transforms all key/value pairs into a new map object', function() {
                    object.set(ALT_KEY, ALT_VALUE);
                    var values = [];
                    values.push(object.data[Object.keys(object.data)[0]]);
                    values.push(object.data[Object.keys(object.data)[1]]);

                    var newMap = object.map(function(x) { return 1000 + x; });
                    newMap.keys.length.should.equal(2);
                    var newVals = [];
                    newVals.push(newMap.data[Object.keys(newMap.data)[0]]);
                    newVals.push(newMap.data[Object.keys(newMap.data)[1]]);

                    should(values).deepEqual([VALUE, ALT_VALUE]);
                    should(newVals).deepEqual([1000 + VALUE, 1000 + ALT_VALUE]);
                });
            });

            test.method('copy', 0, function() {
                it('copies all key/value pairs', function() {
                    object.set(ALT_KEY, ALT_VALUE);
                    var values = [];
                    values.push(object.data[Object.keys(object.data)[0]]);
                    values.push(object.data[Object.keys(object.data)[1]]);

                    var newMap = object.copy();
                    newMap.keys.length.should.equal(2);
                    var newVals = [];
                    newVals.push(newMap.data[Object.keys(newMap.data)[0]]);
                    newVals.push(newMap.data[Object.keys(newMap.data)[1]]);

                    should(values).deepEqual(newVals);
                });
            });
        });
    });
};
