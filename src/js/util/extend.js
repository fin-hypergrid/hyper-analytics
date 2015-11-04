'use strict';

var _ = require('./mu');

/** @summary Mix `extend` into your object.
 * @param {function} Constructor
 * @param {string} [accessorName]
 */
function extendify(Constructor, options) {
    // add the extender as a property of the function (not the prototype!)
    Constructor.extend = extend;

    if (options) {
        if (options.accessor) {
            // add base class access as a property of the prototype
            Constructor.prototype[options.accessor] = accessor;
        }
    }
}

/** @summary Extends an existing constructor into a new constructor.
 *
 * @returns {function} A new constructor, extended from the given context, possibly iwth some prototype additions.
 *
 * @desc Extends "objects" (constructors), with optional additional code, optional prototype additions, and optional prototype member aliases.
 *
 * > CAVEAT: Not to be confused with Underscore-style .extend() which is something else entirely. I've used the name "extend" here because other packages (like Backbone.js) use it this way. You are free to call it whatever you want when you "require" it, such as `var inherits = require('extend')`.
 *
 * Provide a constructor as the context and any prototype additions you require in the first argument.
 *
 * For example, if you wish to extend from `YourObject` with prototype additions in an object `prototype`, usage is:
 * ```javascript
 * extend.call(YourObject, prototype);`
 * ```
 * or if mixed into your object (see `extend: true` below), call it this way:
 * ```javascript
 * yourObject.extend(prototype);
 * ```
 *
 * @param {object} prototype - Object with members to copy to new constructor's prototype. Some have special meanings:
 * * `initialize: function() {...}` - Additional constructor code for new object. Gets passed new object as context + same args as constructor itself. Called on instantiation after similar function in all ancestors called with same signature.
 * * `initializeOwn: function() {...}` - Additional constructor code for new object. Gets passed new object as context + same args as constructor itself. Called on instantiation after (all) the `initialize` function(s).
 * * `extend: true` - Mixes this function into the prototype of the new extended object constructor, essentialy making the object itself extensible.
 * * `extend: 'name'` - Same as above but also mixes in an accessor method with this string as its name.
 * * `aliases: {...}` - Hash of aliases for prototype members in form `{ alias: 'member', ... }` where `'member'` is the name of an existing member in the prototype. Alternatively, ...
 * * `key: '#xxx'` - Adds an alias `key` with same value as existing member `xxx`.
 */
function extend(prototypeAdditions) {
    function Constructor() {
        initializePrototypeChain.apply(this, arguments);

        if (prototypeAdditions.initializeOwn) {
            prototypeAdditions.initializeOwn.apply(this, arguments);
        }
    }

    var prototype = Constructor.prototype = Object.create(this.prototype);
    prototype.constructor = Constructor;

    if (prototypeAdditions) {
        _(prototypeAdditions).each(function(value, key) {
            switch (key) {
                case 'initializeOwn':
                    // already called above; no need to keep
                    break;
                case 'extend':
                    if (typeof value === 'string') {
                        extendify(Constructor, value);
                    } else {
                        extendify(Constructor);
                    }
                    break;
                case 'aliases':
                    _(prototypeAdditions.aliases).each(makeAlias);
                    break;
                default:
                    if (typeof value === 'string' && value[0] === '#') {
                        makeAlias(value, key.substr(1));
                    } else {
                        prototype[key] = value;
                    }
            }
        });
    }

    return Constructor;

    function makeAlias(value, key) {
        prototype[key] = prototypeAdditions[value];
    }
}

/** @summary Call all `initialize` methods found in prototype chain.
 * @desc This recursive routine is called by the constructor.
 * 1. Walks back the prototype chain to `Object`'s prototype
 * 2. Walks forward to new object, calling any `initialize` methods it finds along the way with the same context and arguments with which the constructor was called.
 * @private
 */
function initializePrototypeChain() {
    var term = this,
        args = arguments;
    recur(term);

    function recur(obj) {
        var proto = Object.getPrototypeOf(obj);
        if (proto.constructor !== Object) {
            recur(proto);
            if (proto.initialize) {
                proto.initialize.apply(term, args);
            }
        }
    }
}
/** @summary Method to access other members on the same prototype on which it is defined.
 * @returns Value of named non-method member; or result of calling named method.
 * @desc If member is a function, instead of returning it, the function is called with all the remaining arguments, and the result is returned.
 * @param memberName
 * @param {...*} args
 */
function accessor(memberName) {
    var result = this[memberName];

    if (typeof result === 'function') {
        var remainingArgs = Array.prototype.slice(arguments, 1);
        result = result.apply(this, remainingArgs);
    }

    return result;
}
extend.testing = { // Testing interface - exposed for testing purposes only
    accessor: accessor
};

extend.extendify = extendify; // exposed for making extendable constructors which were not created with `yada.extend({extend:true})`

module.exports = extend;