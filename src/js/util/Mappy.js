'use strict';

/**
 * @constructor
 */
function Mappy() {
    this.keys = [];
    this.data = {};
    this.values = [];
}

Mappy.prototype = {

    constructor: Mappy.prototype.constructor, // preserve constructor

    /**
     * @memberOf Mappy.prototype
     * @param key
     * @param value
     */
    set: function(key, value) {
        var hashCode = hash(key);
        if (!(hashCode in this.data)) {
            this.keys.push(key);
            this.values.push(value);
        }
        this.data[hashCode] = value;
    },

    /**
     * @memberOf Mappy.prototype
     * @param key
     * @returns {*}
     */
    get: function(key) {
        var hashCode = hash(key);
        return this.data[hashCode];
    },

    /**
     *
     * @memberOf Mappy.prototype
     * @param key
     * @param {function} ifUndefinedFunc - Value getter when value is otherwise undefined.
     * @returns {*}
     */
    getIfUndefined: function(key, ifUndefinedFunc) {
        var value = this.get(key);
        if (value === undefined) {
            value = ifUndefinedFunc(key);
            this.set(key, value);
        }
        return value;
    },

    size: function() {
        return this.keys.length;
    },

    /**
     * @memberOf Mappy.prototype
     */
    clear: function() {
        this.keys.length = 0;
        this.values.length = 0;
        this.data = {};
    },

    /**
     * @memberOf Mappy.prototype
     * @param key
     */
    delete: function(key) {
        var hashCode = hash(key);
        if (this.data[hashCode] !== undefined) {
            var index = betterIndexOf(this.keys, key);
            this.keys.splice(index, 1);
            this.values.splice(index, 1);
            delete this.data[hashCode];
        }
    },

    /**
     * @memberOf Mappy.prototype
     * @param {function} iteratee
     */
    forEach: function(iteratee) {
        if (typeof iteratee === 'function') {
            var keys = this.keys,
                self = this;
            keys.forEach(function(key) {
                var value = self.get(key);
                iteratee(value, key, self);
            });
        }
    },

    /**
     * @memberOf Mappy.prototype
     * @param {function} iteratee
     * @returns {Mappy}
     */
    map: function(iteratee) {
        var keys = this.keys,
            newMap = new Mappy(),
            self = this;

        if (!(typeof iteratee === 'function')) {
            iteratee = reflection;
        }

        keys.forEach(function(key) {
            var value = self.get(key),
                transformed = iteratee(value, key, self);
            newMap.set(key, transformed);
        });
        return newMap;
    },

    /**
     * @memberOf Mappy.prototype
     * @returns {Mappy}
     */
    copy: function() {
        var keys = this.keys,
            newMap = new Mappy(),
            self = this;
        keys.forEach(function(key) {
            var value = self.get(key);
            newMap.set(key, value);
        });
        return newMap;
    }

};

var OID_PREFIX = '.~.#%_'; //this should be something we never will see at the beginning of a string
var counter = 0;

function hash(key) {
    var typeOf = typeof key;

    switch (typeOf) {
        case 'number':
        case 'string':
        case 'boolean':
        case 'symbol':
            return OID_PREFIX + typeOf + '_' + key;

        case 'undefined':
            return 'UNDEFINED';

        case 'object':
            if (key === null) {
                return 'NULL';
            }
            // fall through when not null:
        case 'function':
            return (key.___finhash = key.___finhash || OID_PREFIX + counter++);
    }
}

// Object.is polyfill, courtesy of @WebReflection
var is = Object.is || function(a, b) {
    return a === b ? a !== 0 || 1 / a == 1 / b : a != a && b != b; // eslint-disable-line eqeqeq
};

function reflection(val) {
    return val;
}

// More reliable indexOf, courtesy of @WebReflection
function betterIndexOf(arr, value) {
    if (value != value || value === 0) { // eslint-disable-line eqeqeq
        var i = arr.length;
        while (i-- && !is(arr[i], value)) {
            // eslint-disable-line no-empty
        }
    } else {
        i = [].indexOf.call(arr, value);
    }
    return i;
}

module.exports = Mappy;
