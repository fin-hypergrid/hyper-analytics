/* eslint-env node, browser */
'use strict';

var analytics = require('./analytics.js');
var sampleData = require('./sampledata.js');

if (!window.fin) {
    window.fin = {};
}

window.fin.analytics = analytics;
window.fin.sampleData = sampleData;

window.d = new analytics.JSDataSource(sampleData);
window.s1 = new analytics.DataSorter(window.d);
window.s2 = new analytics.DataSorter(window.s1);
window.s3 = new analytics.DataSorter(window.s2);
window.f = new analytics.DataFilter(s3);

var cols = {
    last_name: 0,
    first_name: 1,
    pets: 2,
    birthDate: 3,
    birthState: 4,
    residenceState: 5,
    employed: 6,
    income: 7,
    travel: 8,
    order: 9
};

var first = cols.pets;
var second = cols.birthState;
var third = cols.employed;

window.s = function(a,b,c) {
    console.clear();
    var now = Date.now();
    window.s1.sortOn(third, a); // last name
    window.s2.sortOn(second, b); // state
    window.s3.sortOn(first, c); // pets
    console.log(Date.now() - now);
    window.dump();
};

var f1 = function(a,b,c) {
    return a.startsWith('N');
};

f1.columnIndex = cols.birthState;

window.dump = function() {
    var count = f.getRowCount();
    var displayCount = Math.min(count, 23);
    for (var i = 0; i < displayCount; i++) {
        console.log(i + '       ' + f.getValue(cols.order, i) + '       ' + f.getValue(first, i) + '       ' + f.getValue(second, i) + '       ' + f.getValue(third, i));
    }
    console.log('---------------------------------------');
    for (var i = 0; i < displayCount; i++) {
        var t = Math.max(0, (count-displayCount) + i);
        console.log(t + '       ' + f.getValue(cols.order, t) + '       ' + f.getValue(first, i) + '       ' + f.getValue(second, t) + '       ' + f.getValue(third, t));
    }
}

window.s(1,1,1);
f.addFilter(f1);

dump();
