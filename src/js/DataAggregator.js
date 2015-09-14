'use strict';

var DataSourceSorter = require('./DataSourceSorter');
var DataTree = require('./DataTree');
var DataGroup = require('./DataGroup');
var DataLeaf = require('./DataLeaf');
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
        this.view = [];
        this.sorterInstance;
    }

    DataAggregator.prototype.addAggregate = function(columnName, func) {
        func.columnName = columnName;
        this.aggregates.push(func);
    };

    DataAggregator.prototype.addGroupBy = function(columnIndex) {
        this.groupBys.push(columnIndex);
    };

    DataAggregator.prototype.build = function() {
        this.buildGroupTree();
    };
    DataAggregator.prototype.buildGroupTree = function() {
        var g,value,createFunc;
        var createBranch = function(key, map) {
            var value = new DataGroup(key);
            map.set(key, value);
            return value;
        };
        var createLeaf = function(key, map) {
            var value = new DataLeaf(key);
            map.set(key, value);
            return value;
        };
        var groupBys = this.groupBys;
        var source = this.dataSource;

        // lets sort our data first....
        for (var c = 0; c < groupBys.length; c++) {
            g = groupBys[groupBys.length - c - 1];
            source = new DataSourceSorter(source);
            source.sortOn(g);
        }

        var rowCount = source.getRowCount();
        var tree = new DataTree();
        var path = tree;
        var leafDepth = groupBys.length - 1;
        for (var r = 0; r < rowCount; r++) {
            for (var c = 0; c < groupBys.length; c++) {
                g = groupBys[c];
                value = source.getValue(g, r);

                //test that I'm not a leaf
                createFunc = (c === leafDepth) ? createLeaf : createBranch;
                path = path.children.getIfAbsent(value, createFunc);
            }
            path.rowIndexes.push(r);
            path = tree;
        }
        this.sorterInstance = new DataSourceSorter(source);
        tree.prune();
        this.tree = tree;
        this.tree.computeAggregates(this);
        this.buildView();
    };

    DataAggregator.prototype.buildView = function() {
        this.view.length = 0;
        this.tree.computeHeight();
        this.tree.buildView(this);
    };

    DataAggregator.prototype.getValue = function(x, y) {
        if (y === 0) {
            if (x === 0) {
                return 'hierarchy     |';
            } else {
                return this.aggregates[x - 1].columnName;
            }
        } else {
            return this.view[y - 1].getValue(x); //header row
        }
    };

    DataAggregator.prototype.getColumnCount = function() {

        return this.aggregates.length + 1; // 1 is for the hierarchy column
    };

    DataAggregator.prototype.getRowCount = function() {

        return this.tree.height + 1; //header column
    };

    DataAggregator.prototype.click = function(y) {
        var group = this.view[y];
        group.toggleExpansionState();
        this.buildView();
    };

    return DataAggregator;

})();
