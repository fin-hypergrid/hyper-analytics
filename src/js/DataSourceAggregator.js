'use strict';

var Base = require('./Base');
var DataSourceSorter = require('./DataSourceSorter');
var DataNodeTree = require('./DataNodeTree');
var DataNodeGroup = require('./DataNodeGroup');
var DataNodeLeaf = require('./DataNodeLeaf');
var headerify = require('./util/headerify');

/**
 * @constructor
 * @param {DataSource} dataSource
 */
var DataSourceAggregator = Base.extend('DataSourceAggregator', {
    initialize: function(dataSource) {

        /**
         * @memberOf DataSourceAggregator.prototype
         * @type {DataSource}
         */
        this.dataSource = dataSource;

        /**
         * @memberOf DataSourceAggregator.prototype
         * @type {DataNodeTree}
         */
        this.tree = new DataNodeTree('Totals');

        /**
         * @memberOf DataSourceAggregator.prototype
         * @type {number[]}
         * @default []
         */
        this.index = [];

        /**
         * @memberOf DataSourceAggregator.prototype
         * @type {Array}
         * @default []
         */
        this.aggregates = [];

        /**
         * @memberOf DataSourceAggregator.prototype
         * @type {Array}
         * @default []
         */
        this.groupBys = [];

        /**
         * @memberOf DataSourceAggregator.prototype
         * @type {Array}
         * @default []
         */
        this.view = [];

        /**
         * @memberOf DataSourceAggregator.prototype
         * @type {object}
         * @default {}
         */
        this.sorterInstance = {};

        /**
         * @memberOf DataSourceAggregator.prototype
         * @type {boolean}
         * @default true
         */
        this.presortGroups = true;

        /**
         * @memberOf DataSourceAggregator.prototype
         * @type {object}
         * @default {}
         */
        this.lastAggregate = {};

        this.setAggregates({});
    },

    isNullObject: false,

    /**
     * @memberOf DataSourceAggregator.prototype
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
     * @memberOf DataSourceAggregator.prototype
     * @param label
     * @param func
     */
    addAggregate: function(label, func) {
        func.header = headerify.transform(label);
        this.aggregates.push(func);
    },

    /**
     * @memberOf DataSourceAggregator.prototype
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
     * @memberOf DataSourceAggregator.prototype
     * @param index
     */
    addGroupBy: function(index) {
        this.groupBys.push(index);
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     * @returns {boolean}
     */
    hasGroups: function() {
        return !!this.groupBys.length;
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     * @returns {boolean}
     */
    hasAggregates: function() {
        return !!this.aggregates.length;
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     */
    apply: function() {
        this.buildGroupTree();
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     */
    clearGroups: function() {
        this.groupBys.length = 0;
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     */
    clearAggregations: function() {
        this.aggregates.length = 0;
    },

    /**
     * @memberOf DataSourceAggregator.prototype
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
        tree.computeAggregates(this);
        this.buildView();
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     * @param dataNode
     */
    addView: function(dataNode) {
        this.view.push(dataNode);
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     */
    buildView: function() {
        this.view.length = 0;
        this.tree.computeHeight();
        this.tree.buildView(this);
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     * @returns {*|boolean}
     */
    viewMakesSense: function() {
        return this.hasAggregates() && this.hasGroups();
    },

    getDataIndex: function(y) {
        return this.viewMakesSense() ? y : this.dataSource.getDataIndex(y);
    },

    /**
     * @memberOf DataSourceAggregator.prototype
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
     * @memberOf DataSourceAggregator.prototype
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
     * @memberOf DataSourceAggregator.prototype
     * @returns {*}
     */
    getColumnCount: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getColumnCount();
        }
        return this.getHeaders().length;
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     * @returns {*}
     */
    getRowCount: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getRowCount();
        }
        return this.view.length; //header column
    },

    /**
     * @memberOf DataSourceAggregator.prototype
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
     * @memberOf DataSourceAggregator.prototype
     * @param headers
     */
    setHeaders: function(headers) {
        this.dataSource.setHeaders(headers);
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     * @param fields
     * @returns {*}
     */
    setFields: function(fields) {
        return this.dataSource.setFields(fields);
    },

    /**
     * @memberOf DataSourceAggregator.prototype
     * @returns {object[]}
     */
    getGrandTotals: function() {
        var view = this.tree;
        return [view.data];
    },

    /**
     * @memberOf DataSourceAggregator.prototype
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
     * @memberOf DataSourceAggregator.prototype
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
