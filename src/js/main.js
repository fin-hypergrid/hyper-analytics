/* eslint-env node, browser */
'use strict';

var analytics = require('./analytics.js');
var sampleData = require('./sampledata.js');
var Utils = require('./Utils.js');

if (!window.fin) {
    window.fin = {};
}

window.d = new analytics.JSDataSource(sampleData);
window.f = new analytics.DataSourceFilter(window.d);
window.a = new analytics.DataSourceAggregator(window.f);

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

window.f.addFilter(cols.birthState, function (each) {
    return each.startsWith('A');
});

window.f.addFilter(cols.pets, function (each) {
    return each > 5;
});

window.a.addGroupBy(cols.birthState);
window.a.addGroupBy(cols.last_name);
window.a.addGroupBy(cols.pets);
window.a.addGroupBy(cols.residenceState);

window.a.addAggregate('total', analytics.aggregations.sum(cols.pets));
window.a.addAggregate('count', analytics.aggregations.count());
window.a.addAggregate('minumum', analytics.aggregations.min(cols.pets));
window.a.addAggregate('maximum', analytics.aggregations.max(cols.pets));
window.a.addAggregate('average', analytics.aggregations.avg(cols.pets));
window.a.addAggregate('first', analytics.aggregations.first(cols.birthState));
window.a.addAggregate('last', analytics.aggregations.last(cols.birthState));
window.a.addAggregate('standard_deviation', analytics.aggregations.stddev(cols.pets));

var start = Date.now();
window.a.build();
console.log(Date.now() - start);

//perform a click and dump the table out to the console
window.click = function (y) {
    window.a.click(y);
    console.clear();
    for (var r = 0; r < window.a.getRowCount(); r++) {
        var row = r + ' ';
        for (var c = 0; c < window.a.getColumnCount(); c++) {
            row = row + window.a.getValue(c, r) + '     ';
        }
        console.log(row);
    }
}

//lets try a few clicks
window.click(0);
window.click(1);
window.click(2);