/* global describe, it, beforeEach, afterEach, object */

var extend = require('../../src/js/util/extend');

require('should'); // extends `Object` (!) with `.should`; creates `should()`

function _module(name, tearDown) {
    var blankline = '\n\n',
        header = new Array(29);

    header[header.length >> 1] = '  ' + name.split('').join(' ') + '.js  ';
    header = header.join('—');

    describe(blankline + header + blankline + 'has a module "' + name +'" that', tearDown);
}

function constructorModule(name, extendExpectation, tearDown) {
    if (typeof extendExpectation === 'function') {
        // overload: `extend` omitted
        tearDown = extendExpectation;
        extendExpectation = undefined;
    }

    _module(name, function() {
        var Constructor = require('../../src/js/' + name);
        it('is a function', function () {
            Constructor.should.be.a.Function();
        });
        describe('is a constructor that', function () {
            if (extendExpectation) {
                describe('has an `extend` method that', function() {
                    it('exists', function() {
                        Constructor.should.have.property('extend');
                    });
                    it('properly references the `extend` function', function() {
                        Constructor.extend.should.equal(extend);
                    });
                });
            }
            describe('has a prototype `constructor` property (often stepped on when prototype set to an object) that', function() {
                it('exists', function() {
                    Constructor.prototype.should.have.property('constructor');
                });
                it('properly references the constructor', function() {
                    Constructor.prototype.constructor.should.equal(Constructor);
                });
            });
            if (typeof extendExpectation === 'string') {
                describe('has a prototype `' + extendExpectation + '` method that', function() {
                    it('exists', function() {
                        Constructor.prototype.should.have.property(extendExpectation);
                    });
                    it('properly references the `extend.accessor` function', function() {
                        Constructor.prototype[extendExpectation].should.equal(extend.testing.accessor);
                    });
                });
            }
        });
        if (tearDown) {
            describe('when called as a constructor (with "new")', function() {
                tearDown(Constructor);
            });
        }
    });
}

function method(name, parms, setup, tearDown) {
    if ((!tearDown)) {
        // overload: if only one function given, it is teardown
        tearDown = setup;
        setup = undefined;
    }

    describe('has a member `' + name + '` that', function() {
        if (setup) {
            beforeEach(function() {
                setup();
            });
        }

        it('exists', function() {
            object.should.have.a.property(name);
        });

        it('is a method', function() {
            object[name].should.be.a.Function();
        });

        describe('when called', function() {
            var n = parms || 0;
            it('expects ' + (n ? 'up to ' + n : 'no') + ' parameter' + (n === 1 ? '' : 's'), function() {
                object[name].length.should.equal(n);
            });
            if (tearDown) {
                tearDown();
            }
        });
    })
}

function property(name, isPrivate, tearDown) {
    if (typeof isPrivate === 'function') {
        // overload: `isPrivate` omitted
        tearDown = isPrivate;
        isPrivate = undefined;
    }

    describe('has a ' + (isPrivate ? '*private* ' : '') + 'member `' + name + '` that', function() {
        it('is defined', function() {
            object.should.have.property(name);
        });

        it('is a property (not a method)', function() {
            object[name].should.not.be.a.Function();
        });

        if (tearDown) {
            tearDown();
        }
    })
}

module.exports = {
    module: _module,
    constructorModule: constructorModule,
    method: method,
    property: property
};
