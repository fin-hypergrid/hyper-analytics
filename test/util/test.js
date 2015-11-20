/* global describe, it, beforeEach, afterEach, object */

var extend = require('extend-me');

require('should'); // extends `Object` (!) with `.should`; creates `should()`

function _module(name, tearDown) {
    var blankline = '\n\n',
        header = new Array(29);

    header[header.length >> 1] = '  ' + name.split('').join(' ') + '.js  ';
    header = header.join('—');

    describe(blankline + header + blankline + 'has a module "' + name +'" that', tearDown);
}

function constructorModule(pathname, extended, tearDown) {
    if (typeof extended === 'function') {
        // overload: `extended` omitted
        tearDown = extended;
        extended = undefined;
    }

    var matches = pathname.match(/(\.)?(.*\/)(.*)/),
        dflt = constructorModule.defaultPath,
        path = !matches ? dflt : matches[1] ? matches[2] : dflt + matches[2],
        name = !matches ? pathname : matches[3],
        xxx = console.log(path, name),
        Constructor = require(path + name);

    _module(name, function() {
        it('is a function', function() {
            Constructor.should.be.a.Function();
        });
        describe('is a constructor that', function() {
            if (extended) {
                describe('has an `extend` method that', function() {
                    it('exists', function() {
                        Constructor.should.have.property('extend');
                    });
                    it('references the `extend()` function', function() {
                        Constructor.extend.should.equal(extend);
                    });
                });
            }
            describe('has a prototype that', function() {
                describe('has a `constructor` property that', function() {
                    it('exists', function() {
                        Constructor.prototype.should.have.property('constructor');
                    });
                    it('properly references the constructor', function() {
                        Constructor.prototype.constructor.should.equal(Constructor);
                    });
                });
            });
        });
        if (tearDown) {
            describe('when called as a constructor (with "new")', function() {
                tearDown(Constructor);
            });
        }
    });
}

constructorModule.defaultPath = '../../src/js/';

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

function nullfunc() {}

module.exports = {
    module: _module,
    constructorModule: constructorModule,
    method: method,
    property: property,
    skip: {
        module: nullfunc,
        constructorModule: nullfunc,
        method: nullfunc,
        property: nullfunc
    }
};
