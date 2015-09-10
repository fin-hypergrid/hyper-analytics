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
window.s3 = new analytics.DataSorter(window.s2);

var cols = {
    last_name: 0,
    first_name: 1,
    pets: 2,
    birthDate: 3,
    birthState: 4,
    residenceState: 5,
    employed: 6,
    income: 7,
    travel: 8
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
    var count = s2.getRowCount();
    for (var i = 0; i < 23; i++) {
        console.log(s3.getValue(first, i) + '       ' + s3.getValue(second, i) + '       ' + s3.getValue(third, i));
    }
    console.log('---------------------------------------');
    for (var i = 0; i < 23; i++) {
        var t = (count-23) + i;
        console.log(s3.getValue(first, t) + '       ' + s3.getValue(second, t) + '       ' + s3.getValue(third, t));
    }
};

window.s(1,1,1);
// window.a = [5,4,3,0,3,8,2,9,8,0];

// window.b = ['q','w','e','r','t','y','u','i','o','p'];

// sorts.timsort([0,1,2,3,4,5,6,7,8,9], window.a);
// sorts.timsort([0,1,2,3,4,5,6,7,8,9], window.b);
// console.log(window.a, window.b);
