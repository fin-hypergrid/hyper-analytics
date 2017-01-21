'use strict';

var Base = require('./Base');
var DataSourceSorter = require('./DataSourceSorter');
var DataNodeTree = require('./DataNodeTree');
var DataNodeGroup = require('./DataNodeGroup');
var DataNodeLeaf = require('./DataNodeLeaf');

/**
 * @constructor
 * @param {DataSource} dataSource
 */
var DataSourceGroupView = Base.extend('DataSourceGroupView', {
    initialize: function(dataSource) {

        /**
         * @memberOf DataSourceGroupView#
         * @type {DataSource}
         */
        this.dataSource = dataSource;

        /**
         * @memberOf DataSourceGroupView#
         * @type {DataNodeTree}
         */
        this.tree = new DataNodeTree('Group');

        /**
         * @memberOf DataSourceGroupView#
         * @type {number[]}
         * @default []
         */
        this.index = [];

        /**
         * @memberOf DataSourceGroupView#
         * @type {Array}
         * @default []
         */
        this.groupBys = [];

        /**
         * @memberOf DataSourceGroupView#
         * @type {Array}
         * @default []
         */
        this.view = [];

        /**
         * @memberOf DataSourceGroupView#
         * @type {object}
         * @default {}
         */
        this.treeColumnIndex = 0;

        /**
         * @memberOf DataSourceGroupView#
         * @type {object}
         * @default {}
         */
        this.sorterInstance = {};

        /**
         * @memberOf DataSourceGroupView#
         * @type {boolean}
         * @default true
         */
        this.presortGroups = true;

        this._schema = [];

    },

    get schema() {
        if (this.viewMakesSense()){
            return this._schema;
        } else if (this.dataSource) {
            return this.dataSource.schema;
        }
    },
    set schema(schema) {
        if (this.viewMakesSense()){
            this._schema = schema;
        } else if (this.dataSource) {
            this.dataSource.schema = schema;
        }
    },

    isNullObject: false,

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
        var headers = this.schema.map(function(columnSchema) {
            return columnSchema.name;
        });

        return headers;
    },

    /**
     * @memberOf DataSourceGroupView#
     * @param columnIndexArray
     */
    setGroupBys: function(columnIndexArray) {
        var groupBys = this.groupBys;
        groupBys.length = 0;
        columnIndexArray.forEach(function(columnIndex) {
            groupBys.push(columnIndex);
        });
        var parentSchema = this.dataSource.schema.slice(0);
        parentSchema.unshift({name: 'Tree'});
        this._schema = parentSchema;
    },

    /**
     * @memberOf DataSourceGroupView#
     * @param index
     */
    addGroupBy: function(index) {
        this.groupBys.push(index);
    },

    /**
     * @memberOf DataSourceGroupView#
     * @returns {boolean}
     */
    hasGroups: function() {
        return !!this.groupBys.length;
    },

    /**
     * @memberOf DataSourceGroupView#
     * @params [options]
     */
    apply: function(options) {
        options  = options || {};
        if (!options.rowClick && !options.columnSort){
            this.buildGroupTree();
        }
    },

    /**
     * @memberOf DataSourceGroupView#
     */
    clearGroups: function() {
        this.groupBys.length = 0;
    },

    /**
     * @memberOf DataSourceGroupView#
     */
    buildGroupTree: function() {
        var reversedGroupBys = this.groupBys.slice(0).reverse(),
            leafDepth = this.groupBys.length - 1,
            source = this.dataSource,
            rowCount = source.getRowCount(),
            tree = this.tree = new DataNodeTree('Group');

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
        //this.dump();
    },

    /**
     * @memberOf DataSourceGroupView#
     * @param dataNode
     */
    addView: function(dataNode) {
        this.view.push(dataNode);
    },

    /**
     * @memberOf DataSourceGroupView#
     */
    buildView: function() {
        this.view.length = 0;
        this.tree.computeHeight();
        this.tree.buildView(this);
    },

    /**
     * @memberOf DataSourceGroupView#
     * @returns {*|boolean}
     */
    viewMakesSense: function() {
        return this.hasGroups();
    },

    /**
     * @memberOf DataSourceGroupView#
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
     * @memberOf DataSourceGroupView#
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
     * @memberOf DataSourceGroupView#
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
     * @memberOf DataSourceGroupView#
     * @returns {*}
     */
    getColumnCount: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getColumnCount();
        }
        return this.getHeaders().length;
    },

    /**
     * @memberOf DataSourceGroupView#
     * @returns {*}
     */
    getRowCount: function() {
        if (!this.viewMakesSense()) {
            return this.dataSource.getRowCount();
        }
        return this.view.length; //header column
    },

    /**
     * @memberOf DataSourceGroupView#
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
     * @memberOf DataSourceGroupView#
     * @param headers
     */
    setHeaders: function(headers) {
        this.dataSource.setHeaders(headers);
    },

    /**
     * @memberOf DataSourceGroupView#
     * @param fields
     * @returns {*}
     */
    setFields: function(fields) {
        return this.dataSource.setFields(fields);
    },

    /**
     * @memberOf DataSourceGroupView#
     * @param y
     * @returns {*}
     */
    getRow: function(y) {
        if (!this.viewMakesSense()) {
            return this.dataSource.getRow(y);
        }

        var groups = this.view[y];

        return groups ? groups : this.tree;
    },

    /**
     * @memberOf DataSourceGroupView#
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

Object.defineProperty(DataSourceGroupView.prototype, 'type', { value: 'groupviewer' }); // read-only property

module.exports = DataSourceGroupView;
