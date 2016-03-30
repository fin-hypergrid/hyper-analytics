var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`
var sinon = require('sinon');
require('should-sinon'); // extends Object.should to make should-like asserts for sinon spies

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

            test.method('initialize', 1, function() {
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
                    describe('whose first element', function() {
                        it('is an empty string', function() {
                            object.data[0].should.equal('');
                        });
                    });
                });

                test.property('index', function() {
                    it('is initialized to an empty array', function() {
                        object.index.should.be.an.Array();
                        object.index.length.should.equal(0);
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
            });

            test.method('getValue', 1, function() {
                it('returns nth datum', function() {
                    var value = {};
                    object.data[5] = value;
                    object.getValue(5).should.equal(value);
                });
            });

            // testing for empty characters is a bad test, we need to be able
            // to change this.INDENT to other characters....
            
            test.method('computeDepthString', 0, function() {
                var value;
                describe('returns a value that', function() {
                    it('is a string', function() {
                        object.computeDepthString().should.be.a.String();
                    });
                    function goodPattern() {
                        value = object.computeDepthString();
                        (new RegExp('^ +' + object.label + '$')).test(value).should.be.true();
                        return value;
                    }
                    it('consists of spaces + value of `label`', function() {
                        goodPattern();
                    });
                    it('number of spaces increases in length as `depth` increases', function() {
                        for (var len = 0; object.depth <= 3; ++object.depth, len = value.length) {
                            value = goodPattern();
                            value.length.should.be.greaterThan(len);
                        }
                    });
                });
            });

            test.method('toArray', 1, function() {
                beforeEach(function() {
                    object.toArray(3);
                });
                it('sets the depth', function() {
                    object.depth.should.equal(3);
                });
                it('sets first datum to result of calling `computeDepthString()`', function() {
                    object.data[0].should.equal(object.computeDepthString());
                });
            });

            test.method('computeHeight', 0, function() {
                it('returns the number 1', function() {
                    var value = object.computeHeight();
                    value.should.be.a.Number();
                    value.should.equal(1);
                });
            });

            test.method('getIndex', 0, function() {
                it('returns an array', function() {
                    object.getIndex().should.be.an.Array();
                    var thisArray = object.index = [];
                    object.getIndex().should.equal(thisArray);
                });
            });

            //test.method('applyAggregates', 1, function() {
            //    it('is an alias for `computeAggregates`', function() {
            //        object.applyAggregates.should.equal(object.applyAggregates);
            //    });
            //});

            test.method('computeAggregates', 1);

            test.method('buildView', 1, function() {
                it('adds self to given aggregator\'s view', function() {
                    var aggregator = { addView: sinon.spy() };
                    object.buildView(aggregator);
                    aggregator.addView.should.be.calledWith(object);
                });
            });

            test.method('toggleExpansionState', 0, function() {
                it('has nothing to test', function() {});
            });
        });
    });
};
