/* eslint-env node, browser */
'use strict';

var analytics = require('./analytics.js');
var sampleData = require('./sampledata.js');
var Utils = require('./Utils.js');

if (!window.fin) {
    window.fin = {};
}


window.Utils = Utils;
window.fin.analytics = analytics;
window.fin.sampleData = sampleData;

window.d = new analytics.JSDataSource(sampleData);
window.a = new analytics.DataAggregator(window.d);

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

window.a.addGroupBy(cols.pets);
window.a.addGroupBy(cols.birthState);
window.a.addGroupBy(cols.last_name);

var start = Date.now();
window.a.build();
console.log(Date.now() - start);

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

// window.s(1,1,1);
// f.addFilter(f1);
// f.addFilter(f2);

// var m = new Utils.Map();
// var a = {foo:'a'};
// var b = {foo:'b'};
// var date = new Date();
// var arr = [1,2,3];

// m.put(a, 0);
// m.put(b, 1);
// m.put(1, 2);
// m.put('1', 3);
// m.put(true, 4);
// m.put('true', 5);
// m.put(date, 6);
// m.put(date + '', 7);
// m.put(arr, 8);

// arr.push(4);
// a.bar = 'abar';
// b.bar = 'bbar';

// console.log(m.get(a) === 0);
// console.log(m.get(b) === 1);
// console.log(m.get(1) === 2);
// console.log(m.get('1') === 3);
// console.log(m.get(true) === 4);
// console.log(m.get('true') === 5);
// console.log(m.get(date) === 6);
// console.log(m.get(date + '') === 7);
// console.log(m.get(arr) === 8);

// window.a = a;
// window.b = b;
// window.b = date;
// window.arr = arr;

// var count = f.getRowCount();
// for (var i = 0; i < count; i++) {
//     window.m.set(f.getValue(cols.birthState, i), i);
// }










