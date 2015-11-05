'use strict';

var DataSourceSorter = require('./DataSourceSorter');
var DataNodeTree = require('./DataNodeTree');
var DataNodeGroup = require('./DataNodeGroup');
var DataNodeLeaf = require('./DataNodeLeaf');
var headerify = require('./util/headerify');

//?[t,c,b,a]
// t is a dataSource,
// a is a dicitionary of aggregates,  columnName:function
// b is a dicitionary of groupbys, columnName:sourceColumnName
// c is a list of constraints,

function DataSourceAggregator(dataSource) {
    this.dataSource = dataSource;
    this.tree = new DataNodeTree('Totals');
    this.index = [];
    this.aggregates = [];
    this.groupBys = [];
    this.view = [];
    this.sorterInstance = {};
    this.presortGroups = true;
    this.setAggregates({});
}

DataSourceAggregator.prototype = {
    constructor: DataSourceAggregator.prototype.constructor, // preserve constructor

    isNullObject: false,

    setAggregates: function(aggregations) {
        var i, props = [];

        this.lastAggregate = aggregations;
        this.clearAggregations();
        this.headers = [];

        for (var key in aggregations) {
            props.push([key, aggregations[key]]);
        }

        // if (props.length === 0) {
        //     var fields = [].concat(this.dataSource.getFields());
        //     for (i = 0; i < fields.length; i++) {
        //         props.push([fields[i], Aggregations.first(i)]); /* jshint ignore:line */
        //     }
        // }
        if (this.hasGroups()) {
            this.headers.push('Tree');
        }

        for (i = 0; i < props.length; i++) {
            var agg = props[i];
            this.addAggregate(agg[0], agg[1]);
        }
    },

    addAggregate: function(label, func) {
        this.headers.push(headerify(label));
        this.aggregates.push(func);
    },

    setGroupBys: function(columnIndexArray) {
        this.groupBys.length = 0;
        for (var i = 0; i < columnIndexArray.length; i++) {
            this.groupBys.push(columnIndexArray[i]);
        }
        this.setAggregates(this.lastAggregate);
    },

    addGroupBy: function(index) {
        this.groupBys.push(index);
    },

    hasGroups: function() {
        return this.groupBys.length > 0;
    },

    hasAggregates: function() {
        return this.aggregates.length > 0;
    },

    apply: function() {
        this.buildGroupTree();
    },

    clearGroups: function() {
        this.groupBys.length = 0;
    },

    clearAggregations: function() {
        this.aggregates.length = 0;
        delete this.headers;
    },

    buildGroupTree: function() {
        var c, r, g, value, createFunc;
        var createBranch = function(key, map) {
            value = new DataNodeGroup(key);
            map.set(key, value);
            return value;
        };
        var createLeaf = function(key, map) {
            value = new DataNodeLeaf(key);
            map.set(key, value);
            return value;
        };
        var groupBys = this.groupBys;
        var source = this.dataSource;
        var rowCount = source.getRowCount();

        // lets sort our data first....
        if (this.presortGroups) {
            for (c = 0; c < groupBys.length; c++) {
                g = groupBys[groupBys.length - c - 1];
                source = new DataSourceSorter(source);
                source.sortOn(g);
            }
        }

        var tree = this.tree = new DataNodeTree('Totals');
        var path = tree;
        var leafDepth = groupBys.length - 1;
        for (r = 0; r < rowCount; r++) {
            for (c = 0; c < groupBys.length; c++) {
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
        this.tree.computeAggregates(this);
        this.buildView();
    },

    buildView: function() {
        this.view.length = 0;
        this.tree.computeHeight();
        this.tree.buildView(this);
    },

    viewMakesSense: function() {
        return this.hasAggregates();
    },

    getValue: function(x, y) {
        if (!this.viewMakesSense()) {
            return this.dataSource.getValue(x, y);
        }
        var row = this.view[y];
        if (!row) {
            return null;
        }
        return row.getValue(x); // TODO: what kind of object is row... ? should it be unfiltred?
    },

    setValue: function(x, y, value) {
        if (!this.viewMakesSense()) {
            return this.dataSource.setValue(x, y, value);
        }
    },

    getColumnCount: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getColumnCount();
        }
        return this.getHeaders().length;
    },

    getRowCount: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getdRowCount();
        }
        return this.view.length; //header column
    },

    click: function(y) {
        var group = this.view[y];
        group.toggleExpansionState(this);
        this.buildView();
    },

    getHeaders: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getHeaders();
        }
        return this.headers; // TODO: Views override dataSource headers with their own headers?
    },

    setHeaders: function(headers) {
        this.dataSource.setHeaders(headers);
    },

    getFields: function() {
        return this.dataSource.getFields();
    },

    setFields: function(fields) {
        return this.dataSource.setFields(fields);
    },

    getGrandTotals: function() {
        var view = this.tree;
        return [view.data];
    },

    getRow: function(y) {
        if (!this.viewMakesSense()) {
            return this.dataSource.getRow(y);
        }

        var rollups = this.view[y];

        return rollups ? rollups : this.tree;
    },

    setData: function(arrayOfUniformObjects) {
        this.dataSource.setData(arrayOfUniformObjects);
        this.apply();
    }
};

module.exports = DataSourceAggregator;