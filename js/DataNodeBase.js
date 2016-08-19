'use strict';

var Base = require('./Base');

/**
 * See {@link DataBaseNode#initialize|initialize()} method for parameters.
 * @constructor
 */
var DataNodeBase = Base.extend('DataNodeBase', {

    isNullObject: false,

    INDENT: '   ', // 3 spaces

    /**
     * @memberOf DataNodeBase#
     * @param {string} key
     */
    initialize: function(key) {
        /**
         * @memberOf DataNodeBase#
         * @type {string}
         */

        this.label = key;

        /**
         * @memberOf DataNodeBase#
         * @type {string[]}
         * @default false
         */
        this.data = [''];

        /**
         * @memberOf DataNodeBase#
         * @type {number[]}
         * @default ['']
         */
        this.index = []; // formerly rowIndex

        /**
         * @memberOf DataNodeBase#
         * @type {boolean}
         * @default false
         */
        this.hasChildren = true;

        /**
         * @memberOf DataNodeBase#
         * @type {number}
         * @default 0
         */
        this.depth = 0;

        /**
         * @memberOf DataNodeBase#
         * @type {number}
         * @default 1
         */
        this.height = 1;

        /**
         * @memberOf DataNodeBase#
         * @type {boolean}
         * @default false
         */
        this.expanded = false;
    },

    /**
     * @memberOf DataNodeLeaf#
     * @param x
     * @returns {*}
     */
    getValue: function(x) {
        return this.data[x];
    },

    /**
     * @memberOf DataNodeLeaf#
     * @param depth
     */
    toArray: function(depth) {
        this.depth = depth;
        this.data[0] = this.computeDepthString();
    },

    /**
     * @memberOf DataNodeLeaf#
     * @returns {string}
     */
    computeDepthString: function() {
        return Array(this.depth + 1).join(this.INDENT) + '  ' + this.label;
    },

    /**
     * @memberOf DataNodeLeaf#
     * @returns {number}
     */
    computeHeight: function() {
        return 1;
    },

    /**
     * @memberOf DataNodeLeaf#
     * @returns {Array}
     */
    getIndex: function() { // TODO: formerly getAllRowIndexes
        return this.index;
    },

    /**
     * @memberOf DataNodeLeaf#
     * @param drillDown
     */
    getRowData: function(drillDown) {
        var index = this.getIndex();

        if (index.length) {
            // Group and Tree nodes will have no data besides the tree column
            this.data.length = drillDown.getColumnCount();
        }
    },

    /**
     * @memberOf DataNodeLeaf#
     * @param drillDown
     */
    buildView: function(drillDown) {
        drillDown.addView(this);
    },

    /**
     * @memberOf DataNodeLeaf#
     */
    toggleExpansionState: function() {
        //do nothing by default
    },

    sortGroups: function(groupSorter) {
    }
});


module.exports = DataNodeBase;
