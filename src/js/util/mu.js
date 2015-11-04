/* mu.js - Mini Underscore
 * by Jonathan Eiten
 *
 * The methods below operate on objects (but not arrays) similarly
 * to Underscore (http://underscorejs.org/#collections).
 *
 * Recommended usage:
 *
 *    var µ = require('mu');
 *
 * That character is the Greek letter mu (option-m on a Mac).
 * You can use _ if you'd rather, but you may confuse folks!
 */

'use strict';

function µ(obj) {
    if (obj instanceof µ) {
        return obj;
    }
    if (!(this instanceof µ)) {
        return new µ(obj); // eslint-disable-line new-cap
    }
    this.o = obj;
}

µ.chain = function(obj) {
    var wrapped = µ(obj);
    wrapped.chaining = true;
    return wrapped;
};

µ.prototype = {
    value: function() {
        return this.o;
    },

    each: function(iteratee, context) {
        var o = this.o;
        context = context || o;
        Object.keys(o).forEach(function(key) {
            iteratee.call(context, o[key], key, o);
        });
        return this;
    },

    find: function(predicate, context) {
        var o = this.o;
        context = context || o;
        var result = Object.keys(o).find(function(key) {
            return predicate.call(context, o[key], key, o);
        });
        return result === undefined ? undefined : o[result];
    },

    reduce: function(iteratee, memo, context) {
        var o = this.o;
        context = context || o;
        Object.keys(o).forEach(function(key, idx) {
            memo = (!idx && memo === undefined) ? o[key] : iteratee.call(context, memo, o[key], key, o);
        });
        return memo;
    },

    // copies only the objects' own members
    extendOwn: function() {
        var o = this.o;
        Array.prototype.slice.call(arguments).forEach(function(obj) {
            µ(obj).each(function(val, key) {
                o[key] = val;
            });
        });
        return this.chaining ? this : o;
    },

    // copies own + inherited members (from prototype chain)
    extend: function() {
        var o = this.o;
        Array.prototype.slice.call(arguments).forEach(function(obj) {
            for (var key in obj) {
                o[key] = obj[key];
            }
        });
        return this.chaining ? this : o;
    }
};

module.exports = µ;