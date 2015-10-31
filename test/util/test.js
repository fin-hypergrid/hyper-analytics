/* global describe, it, beforeEach, afterEach, properties, methods, object */

function itIsAnAPI() {
    it('is an API', function() {
        // should be an object with methods and/or properties
        object.should.be.an.Object();
        properties = methods = 0;
        for (var key in object) {
            var isMethod = typeof object[key] === 'function';
            methods += isMethod;
            properties += !isMethod;
        }
        (methods + properties).should.not.equal(0);
    });
}

function testModule(name) {
    var blankline = '\n\n',
        header = new Array(19);
    header[header.length >> 1] = name + '.js  ';
    return blankline + header.join('•  ') + blankline + 'has a module "' + name +'" that';
}

function constructorModule(name, tearDown) {
    testModule(name, function() {
        var module = require('../src/js/' + name);
        it('is a function', function () {
            module.should.be.a.Function();
        });
        it('is a constructor', function () {
            module.prototype.constructor.should.equal(module);
        });
        if (tearDown) {
            tearDown(module);
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
            --methods;
            (name in object).should.be.true();
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
            --properties;
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
    itIsAnAPI: itIsAnAPI,
    module: testModule,
    constructorModule: constructorModule,
    method: method,
    property: property
};
