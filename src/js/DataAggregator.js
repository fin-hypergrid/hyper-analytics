'use strict';

var DataSorter = require('./DataSorter');
var Map = require('./map');

module.exports = (function() {

    //?[t,c,b,a]
    // t is a dataSource,
    // a is a dicitionary of aggregates,  columnName:function
    // b is a dicitionary of groupbys, columnName:sourceColumnName
    // c is a list of constraints,

    function DataAggregator(dataSource) {
        this.dataSource = dataSource;
        this.aggregates = [];
        this.groupBys = [];
    }

    DataAggregator.prototype.addAggregate = function(func) {
        this.aggregates.push(func);
    };

    DataAggregator.prototype.addGroupBy = function(columnIndex) {
        this.groupBys.push(columnIndex);
    };

    DataAggregator.prototype.build = function() {
        this.buildGroupTree();
    };
    DataAggregator.prototype.buildGroupTree = function() {
        var createBranch = function(key, map) {
            var value = {
                label: key,
                children: new Map(),
                hasChildren: true
            };
            map.set(key, value);
            return value;
        };
        var createLeaf = function(key, map) {
            var value = {
                label: key,
                hasChildren: false
            };
            map.set(key, value);
            return value;
        };
        var groupBys = this.groupBys;
        var source = this.dataSource;
        var rowCount = source.getRowCount();
        var tree = {
            children: new Map(),
        };
        var path = tree;
        var leafDepth = groupBys.length - 1;
        var g,value,createFunc;
        for (var r = 0; r < rowCount; r++) {
            for (var c = 0; c < groupBys.length; c++) {
                g = groupBys[c];
                value = source.getValue(g, r);

                //test that I'm not a leaf
                createFunc = (c === leafDepth) ? createLeaf : createBranch;
                path = path.children.getIfAbsent(value, createFunc);
            }
            path.rowIndex = r;
            path = tree;
        }
        this.tree = tree;
    };

    DataAggregator.prototype.getValue = function(x, y) {
        return x + ', '+ y;
    };

    DataAggregator.prototype.getColumnCount = function() {

        return this.aggregates.length + 1; // 1 is for the hierarchy column
    };

    DataAggregator.prototype.getRowCount = function() {

        return this.data.length;
    };

    return DataAggregator;

})();
