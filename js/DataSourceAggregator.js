'use strict';

var Base = require('./Base');
var DataSourceSorter = require('./DataSourceSorter');
var DataNodeTree = require('./AggregatorNodeTree');
var DataNodeGroup = require('./AggregatorNodeGroup');
var DataNodeLeaf = require('./AggregatorNodeLeaf');
var headerify = require('./util/headerify');

/**
 * @constructor
 * @param {DataSource} dataSource
 */
var DataSourceAggregator = Base.extend('DataSourceAggregator', {
    initialize: function(dataSource) {

        /**
         * @memberOf DataSourceAggregator#
         * @type {DataSource}
         */
        this.dataSource = dataSource;

        /**
         * @memberOf DataSourceAggregator#
         * @type {DataSource}
         */
        this.treeColumnIndex = 0;

        /**
         * @memberOf DataSourceAggregator#
         * @type {DataNodeTree}
         */
        this.tree = new DataNodeTree('Totals');

        /**
         * @memberOf DataSourceAggregator#
         * @type {number[]}
         * @default []
         */
        this.index = [];

        /**
         * @memberOf DataSourceAggregator#
         * @type {Array}
         * @default []
         */
        this.aggregates = [];

        /**
         * @memberOf DataSourceAggregator#
         * @type {Array}
         * @default []
         */
        this.groupBys = [];

        /**
         * @memberOf DataSourceAggregator#
         * @type {Array}
         * @default []
         */
        this.view = [];

        /**
         * @memberOf DataSourceAggregator#
         * @type {object}
         * @default {}
         */
        this.sorterInstance = {};

        /**
         * @memberOf DataSourceAggregator#
         * @type {boolean}
         * @default true
         */
        this.presortGroups = true;

        /**
         * @memberOf DataSourceAggregator#
         * @type {object}
         * @default {}
         */
        this.lastAggregate = {};

        this.setAggregates({});
    },

    isNullObject: false,


    /**
     * @memberOf DataSourceAggregator#
     * @param aggregations, groups
     */
    setAggregateGroups: function(aggregations, groups) {
        this.setGroupBys(groups);
        this.setAggregates(aggregations);
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param aggregations
     */
    setAggregates: function(aggregations) {
        this.lastAggregate = aggregations;
        this.clearAggregations();

        for (var key in aggregations) {
            this.addAggregate(key, aggregations[key]);
        }

    },

    getFields: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getFields();
        }
        var fields = this.getHeaders().map(function(e) {
            return e.toLowerCase().split(' ').join('_');
        });
        return fields;
    },

    getHeaders: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getHeaders();
        }
        var headers = this.aggregates.map(function(e) {
            return e.header;
        });
        if (this.hasGroups()) {
            headers.unshift('Tree');
        }
        return headers;
    },
    /**
     * @memberOf DataSourceAggregator#
     * @param label
     * @param func
     */
    addAggregate: function(label, func) {
        func.header = headerify.transform(label);
        this.aggregates.push(func);
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param columnIndexArray
     */
    setGroupBys: function(columnIndexArray) {
        var groupBys = this.groupBys;
        groupBys.length = 0;
        columnIndexArray.forEach(function(columnIndex) {
            groupBys.push(columnIndex);
        });
        this.setAggregates(this.lastAggregate);
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param index
     */
    addGroupBy: function(index) {
        this.groupBys.push(index);
    },

    /**
     * @memberOf DataSourceAggregator#
     * @returns {boolean}
     */
    hasGroups: function() {
        return !!this.groupBys.length;
    },

    /**
     * @memberOf DataSourceAggregator#
     * @returns {boolean}
     */
    hasAggregates: function() {
        return !!this.aggregates.length;
    },

    /**
     * @memberOf DataSourceAggregator#
     * @params [options]
     */
    apply: function(options) {
        options  = options || {};
        if (!options.rowClick && !options.columnSort){
            this.buildGroupTree();
        }
    },

    /**
     * @memberOf DataSourceAggregator#
     */
    clearGroups: function() {
        this.groupBys.length = 0;
    },

    /**
     * @memberOf DataSourceAggregator#
     */
    clearAggregations: function() {
        this.aggregates.length = 0;
    },

    /**
     * @memberOf DataSourceAggregator#
     */
    buildGroupTree: function() {
        var reversedGroupBys = this.groupBys.slice(0).reverse(),
            leafDepth = this.groupBys.length - 1,
            source = this.dataSource,
            rowCount = source.getRowCount(),
            tree = this.tree = new DataNodeTree('Totals');

        // first sort data
        if (this.presortGroups) {
            reversedGroupBys.forEach(function(groupBy) {
                source = new DataSourceSorter(source);
                source.sortOn(groupBy);
            });
        }

        for (var r = 0; r < rowCount; r++) {
            var path = tree;

            this.groupBys.forEach(function(g, c) { // eslint-disable-line no-loop-func
                var key = source.getValue(g, r),
                    factoryDataNode = (c === leafDepth) ? factoryDataNodeLeaf : factoryDataNodeGroup;
                path = path.children.getIfUndefined(key, factoryDataNode);
            });

            path.index.push(r);
        }

        this.sorterInstance = new DataSourceSorter(source);
        tree.toArray();
        tree.getRowData(this);
        this.buildView();
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param dataNode
     */
    addView: function(dataNode) {
        this.view.push(dataNode);
    },

    /**
     * @memberOf DataSourceAggregator#
     */
    buildView: function() {
        this.view.length = 0;
        this.tree.computeHeight();
        this.tree.buildView(this);
    },

    /**
     * @memberOf DataSourceAggregator#
     * @returns {*|boolean}
     */
    viewMakesSense: function() {
        return this.hasAggregates() && this.hasGroups();
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param {number} columnIndex
     * @returns {*|boolean}
     */
    isDrillDown: function(columnIndex) {
        var result = this.viewMakesSense();
        if (result && columnIndex) {
            result = columnIndex === this.treeColumnIndex;
        }
        return result;
    },

    getDataIndex: function(y) {
        return this.viewMakesSense() ? y : this.dataSource.getDataIndex(y);
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param x
     * @param y
     * @returns {*}
     */
    getValue: function(x, y) {
        if (!this.viewMakesSense()) {
            return this.dataSource.getValue(x, y);
        }
        var row = this.view[y];
        return row ? row.getValue(x) : null;
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param x
     * @param y
     * @param value
     * @returns {*}
     */
    setValue: function(x, y, value) {
        if (!this.viewMakesSense()) {
            return this.dataSource.setValue(x, y, value);
        }
    },

    /**
     * @memberOf DataSourceAggregator#
     * @returns {*}
     */
    getColumnCount: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getColumnCount();
        }
        return this.getHeaders().length;
    },

    /**
     * @memberOf DataSourceAggregator#
     * @returns {*}
     */
    getRowCount: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getRowCount();
        }
        return this.view.length; //header column
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param y
     * @param {boolean} [expand] - One of:
     * * `true` - Expand all rows that are currently collapsed.
     * * `false` - Collapse all rows that are currently expanded.
     * * `undefined` (or omitted) - Expand all currently collapsed rows; collapse all currently expanded rows.
     * @param {number} [depth=Infinity] - One of:
     * * number > 0 - Apply only if row depth is above the given depth.
     * * number <= 0 - Apply only if row depth is below the given depth.
     * @returns {undefined|boolean} One of:
     * * `undefined` - row was not expandable
     * * `true` - row was expandable _and_ state changed
     * * `false` - row was expandable _but_ state did _not_ change
     */
    click: function(y, expand, depth) {
        if (!this.viewMakesSense()) {
            return this.dataSource.click.apply(this.dataSource, arguments);
        }
        var group = this.view[y], expandable, changed;
        if (
            group && (
                depth === undefined ||
                depth > 0 && group.depth < depth ||
                depth <= 0 && group.depth >= -depth
            )
        ) {
            changed = group.toggleExpansionState(this, expand);
            if ((expandable = group.children)) {
                this.buildView();
            }
        }

        return expandable ? changed : undefined;
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param headers
     */
    setHeaders: function(headers) {
        this.dataSource.setHeaders(headers);
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param fields
     * @returns {*}
     */
    setFields: function(fields) {
        return this.dataSource.setFields(fields);
    },

    /**
     * @memberOf DataSourceAggregator#
     * @returns {object[]}
     */
    getGrandTotals: function() {
        var view = this.tree;
        return [view.data];
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param y
     * @returns {*}
     */
    getRow: function(y) {
        if (!this.viewMakesSense()) {
            return this.dataSource.getRow(y);
        }

        var rollups = this.view[y];

        return rollups ? rollups : this.tree;
    },

    /**
     * @memberOf DataSourceAggregator#
     * @param arrayOfUniformObjects
     */
    setData: function(arrayOfUniformObjects) {
        this.dataSource.setData(arrayOfUniformObjects);
        this.apply();
    },

    sortGroups: function(groupSorter) {
        this.tree.clearGroupSorts();
        this.tree.sortWith(groupSorter);
        this.buildView();
    }
});

function factoryDataNodeLeaf(key) {
    return new DataNodeLeaf(key);
}

function factoryDataNodeGroup(key) {
    return new DataNodeGroup(key);
}

module.exports = DataSourceAggregator;
