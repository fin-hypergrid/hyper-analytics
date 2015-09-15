'use strict';

module.exports = (function () {

    var oidPrefix = '.~.#%_'; //this should be something we never will see at the begining of a string
    var counter = 0;

    var hash = function (key) {
        var typeOf = typeof key;
        switch (typeOf) {
        case 'number':
            return oidPrefix + typeOf + '_' + key;
            break;
        case 'string':
            return oidPrefix + typeOf + '_' + key;
            break;
        case 'boolean':
            return oidPrefix + typeOf + '_' + key;
            break;
        case 'symbol':
            return oidPrefix + typeOf + '_' + key;
            break;
        case 'undefined':
            return oidPrefix + 'undefined';
            break;
        case 'object':
            if (key.___finhash) {
                return key.___finhash;
            }
            key.___finhash = oidPrefix + counter++;
            return key.___finhash;
            break;
        case 'function':
            if (key.___finhash) {
                return key.___finhash;
            }
            key.___finhash = oidPrefix + counter++;
            return key.___finhash;
            return oidPrefix + 'undefined';
            break;
        }
    };

    // Object.is polyfill, courtesy of @WebReflection
    var is = Object.is ||
    function (a, b) {
        return a === b ? a !== 0 || 1 / a == 1 / b : a != a && b != b;
    };

    // More reliable indexOf, courtesy of @WebReflection
    var betterIndexOf = function (arr, value) {
        if (value != value || value === 0) {
            for (var i = arr.length; i-- && !is(arr[i], value);) {}
        } else {
            i = [].indexOf.call(arr, value);
        }
        return i;
    };

    function Map() {
        this.keys = [];
        this.data = {};
        this.values = [];
    }

    Map.prototype.set = function (key, value) {
        var hashCode = hash(key);
        if (this.data[hashCode] === undefined) {
            this.keys.push(key);
            this.values.push(value);
        }
        this.data[hashCode] = value;
    };

    Map.prototype.get = function (key) {
        var hashCode = hash(key);
        return this.data[hashCode];
    };

    Map.prototype.getIfAbsent = function (key, ifAbsentFunc) {
        var value = this.get(key);
        if (value === undefined) {
            value = ifAbsentFunc(key, this);
        }
        return value;
    };

    Map.prototype.size = function () {
        return this.keys.length;
    };

    Map.prototype.clear = function () {
        this.keys.length = 0;
        this.data = {};
    };

    Map.prototype.delete = function (key) {
        var hashCode = hash(key);
        if (this.data[hashCode] === undefined) {
            return;
        }
        var index = betterIndexOf(this.keys, key);
        this.keys.splice(index, 1);
        this.values.splice(index, 1);
        delete this.data[hashCode];
    };

    Map.prototype.forEach = function (func) {
        var keys = this.keys;
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = this.get(key);
            func(value, key, this);
        }
    };

    Map.prototype.map = function (func) {
        var keys = this.keys;
        var newMap = new Map();
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = this.get(key);
            var transformed = func(value, key, this);
            newMap.set(key, transformed);
        }
        return newMap;
    };

    Map.prototype.copy = function () {
        var keys = this.keys;
        var newMap = new Map();
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = this.get(key);
            newMap.set(key, value);
        }
        return newMap;
    };

    return Map;

})();