/* eslint-env node, browser */
'use strict';

// require('./index.js');
var analytics = hyperAnalytics;//eslint-disable-line no-undef
var sampleData = analytics.util.generateSampleData(1000);

if (!window.fin) {
    window.fin = {};
}

window.d = new analytics.JSDataSource(sampleData);
window.f = new analytics.DataSourceGlobalFilter(window.d);
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

// window.f.add(cols.birthState, function(each) {
//     return each.startsWith('A');
// });

// window.f.add(cols.pets, function(each) {
//     return each > 5;
// });

window.a.addGroupBy(cols.last_name);
window.a.addGroupBy(cols.first_name);
window.a.addGroupBy(cols.birthState);
// window.a.addGroupBy(cols.pets);
// window.a.addGroupBy(cols.residenceState);
//window.a.setGroupBys([cols.last_name, cols.first_name]);

window.a.addAggregate('total', analytics.util.aggregations.sum(cols.pets));
window.a.addAggregate('count', analytics.util.aggregations.count());
window.a.addAggregate('minumum', analytics.util.aggregations.min(cols.pets));
window.a.addAggregate('maximum', analytics.util.aggregations.max(cols.pets));
window.a.addAggregate('average', analytics.util.aggregations.avg(cols.pets));
window.a.addAggregate('first', analytics.util.aggregations.first(cols.birthState));
window.a.addAggregate('last', analytics.util.aggregations.last(cols.birthState));
window.a.addAggregate('standard_deviation', analytics.util.aggregations.stddev(cols.pets));

//perform a click and dump the table out to the console

var start = Date.now();
window.a.apply();
console.log(Date.now() - start);

//lets try a few clicks
window.a.click(3);
window.a.click(5);

window.a.dump(100);