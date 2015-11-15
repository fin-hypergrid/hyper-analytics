'use strict';

/* eslint-env node, browser */

if (!window.fin) {
    window.fin = {};
}
if (!window.fin.analytics) {
    window.fin.analytics = require('./namespace');
}