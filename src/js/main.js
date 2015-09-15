/* eslint-env node, browser */
'use strict';

var analytics = require('./analytics.js');

if (!window.fin) {
    window.fin = {};
}
if (!window.fin.analytics) {
    window.fin.analytics = analytics;
}