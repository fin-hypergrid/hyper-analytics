'use strict';

// NOTE: For backwards compatibility, `capitalize` is still a function, doubling now as the API.

function capitalize(string) {
    return (/[a-z]/.test(string) ? string : string.toLowerCase())
        .replace(/[\s\-_]*([^\s\-_])([^\s\-_]+)/g, replacer)
        .replace(/[A-Z]/g, ' $&')
        .trim();
}

function replacer(a, b, c) {
    return b.toUpperCase() + c;
}

function set(methodName) {
    capitalize.transform = capitalize[methodName];
}

function passthrough(string) {
    return string;
}

capitalize.transform = passthrough;
capitalize.set = set;
capitalize.passthrough = passthrough;
capitalize.capitalize = capitalize;

module.exports = capitalize;
