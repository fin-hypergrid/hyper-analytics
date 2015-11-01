/* global describe, it, beforeEach, afterEach, object */

function _module(name, tearDown) {
    var blankline = '\n\n',
        header = new Array(19);

    header[header.length >> 1] = name + '.js  ';
    header = header.join('•  ');

    describe(blankline + header + blankline + 'has a module "' + name +'" that', tearDown);
}

function constructorModule(name, tearDown) {
    _module(name, function() {
        var Constructor = require('../../src/js/' + name);
        it('is a function', function () {
            Constructor.should.be.a.Function();
        });
        describe('is a constructor', function () {
            it('prototype has a `constructor` property (often stepped on by assigning object to prototype)', function() {
                Constructor.prototype.should.have.property('constructor');
            });
            it('prototype\'s `constructor` property properly references the constructor', function() {
                Constructor.prototype.constructor.should.equal(Constructor);
            });
        });
        if (tearDown) {
            describe('when called as a constructor (with "new")', function() {
                tearDown(Constructor);
            });
        }
    });
}

function method(name, parms, setup, tearDown) {
    if ((!tearDown)) { // if only one function given, it is teardown
        tearDown = setup;
        setup = undefined;
    }
    describe('has a member `' + name + '` that', function() {
        if (setup) {
            beforeEach(function() {
                setup();
            });
        }

        it('is defined', function() {
            object.should.have.property(name);
        });

        it('is a method', function() {
            object[name].should.have.type('function');
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

function property(name, tearDown) {
    describe('has a member `' + name + '` that', function() {
        it('is defined', function() {
            (name in object).should.be.true();
        });

        it('is a property (not a method)', function() {
            object[name].should.not.have.type('function');
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
