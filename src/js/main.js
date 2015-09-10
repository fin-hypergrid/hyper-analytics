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

window.s = function(a,b,c) {
    console.clear();
    var now = Date.now();
    window.s1.sortOn(0, c); // last name
    window.s2.sortOn(4, b); // state
    window.s3.sortOn(2, a); // pets
    console.log(Date.now() - now);
    var count = s2.getRowCount();
    for (var i = 0; i < 23; i++) {
        console.log(s3.getValue(2, i) + '       ' + s3.getValue(4, i) + '       ' + s3.getValue(0, i));
    }
    console.log('---------------------------------------');
    for (var i = 0; i < 23; i++) {
        var t = (count-23) + i;
        console.log(s3.getValue(2, t) + '       ' + s3.getValue(4, t) + '       ' + s3.getValue(0, t));
    }
};

window.s(1,1,1);
// window.a = [5,4,3,0,3,8,2,9,8,0];

// window.b = ['q','w','e','r','t','y','u','i','o','p'];

// sorts.timsort([0,1,2,3,4,5,6,7,8,9], window.a);
// sorts.timsort([0,1,2,3,4,5,6,7,8,9], window.b);
// console.log(window.a, window.b);
