/* eslint-env node, browser */
'use strict';

var analytics = require('./analytics.js');
var sampleData = require('./sampledata.js');
var sorts = require('./Utils.js');

if (!window.fin) {
    window.fin = {};
}

window.fin.analytics = analytics;
window.fin.sampleData = sampleData;
window.sorts = sorts;

window.d = new analytics.JSDataSource(sampleData);
window.s1 = new analytics.DataSorter(window.d);
window.s2 = new analytics.DataSorter(window.s1);

var now = Date.now();
//window.s1.sortOn(1);
window.s2.sortOn(0);
console.log(Date.now() - now);
var count = s2.getRowCount();
for (var i = 0; i < count; i++) {
    console.log(s2.getValue(0, i) + '		' + s2.getValue(1, i));
}

