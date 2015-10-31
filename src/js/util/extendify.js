'use strict';

function extendify(constructor, accessorName) {
    // mixin the extender
    constructor.extend = extend;

    // add base class access to prototype
    constructor.prototype[accessorName || 'super'] = accessor;
}

/**
 * @summary Extends object, with optional additional code, optional prototype additions, and optional prototype member aliases.
 *
 * @param {function} [options.initialize] - Additional constructor code for new object; gets passed same args as constructor itself.
 *
 * @param {object} [options.prototype] - Items to mix into new object's prototype.
 *
 * @param {object} [options.aliases] - Hash of aliases for prototype members in form `{ alias: 'member', ... }` where `'member'` is the name of an existing member in `prototypeAdditions`.
 *
 * @returns {function} New constructor with prototype.
 */
function extend(options) {
    var Base = this;

    function Constructor() {
        Base.apply(this, arguments);

        if (options.initialize) {
            options.initialize.apply(this, arguments);
        }
    }

    var prototype = Constructor.prototype = Object.create(Base.prototype);
    prototype.constructor = Constructor;

    if (options.prototype) {
        Object.keys(options.prototype).forEach(function(key) {
            prototype[key] = options.prototype[key];
        });
    }

    if (options.aliases) {
        Object.keys(options.aliases).forEach(function(key) {
            var existingMemberName = options.aliases[key];

            if (!(existingMemberName in prototype)) {
                throw 'Extendify: Alias value not found in prototype object.';
            }

            prototype[key] = prototype[existingMemberName];
        });
    }

    return Constructor;
}

function accessor(methodName) {
    var result = this[methodName];

    if (typeof result === 'function') {
        var remainingArgs = Array.prototype.slice(arguments, 1);
        result = result.apply(this, remainingArgs);
    }

    return result;
}

module.exports = extendify;