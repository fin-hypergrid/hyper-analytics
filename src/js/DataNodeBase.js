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
     * @memberOf DataNodeBase.prototype
     * @param {string} key
     */
    initialize: function(key) {
        /**
         * @memberOf DataNodeBase.prototype
         * @type {string}
         */

        this.label = key;

        /**
         * @memberOf DataNodeBase.prototype
         * @type {string[]}
         * @default false
         */
        this.data = ['']; // TODO: Why is this first element needed?

        /**
         * @memberOf DataNodeBase.prototype
         * @type {number[]}
         * @default ['']
         */
        this.index = []; // TODO: formerly rowIndex

        /**
         * @memberOf DataNodeBase.prototype
         * @type {boolean}
         * @default false
         */
        this.hasChildren = false; // Not being used

        /**
         * @memberOf DataNodeBase.prototype
         * @type {number}
         * @default 0
         */
        this.depth = 0;

        /**
         * @memberOf DataNodeBase.prototype
         * @type {number}
         * @default 1
         */
        this.height = 1;

        /**
         * @memberOf DataNodeBase.prototype
         * @type {boolean}
         * @default false
         */
        this.expanded = false;
    },

    /**
     * @memberOf DataNodeLeaf.prototype
     * @param x
     * @returns {*}
     */
    getValue: function(x) {
        return this.data[x];
    },

    /**
     * @memberOf DataNodeLeaf.prototype
     * @param depth
     */
    toArray: function(depth) {
        this.depth = depth;
        this.data[0] = this.computeDepthString();
    },

    /**
     * @memberOf DataNodeLeaf.prototype
     * @returns {string}
     */
    computeDepthString: function() {
        return Array(this.depth + 1).join(this.INDENT) + '  ' + this.label;
    },

    /**
     * @memberOf DataNodeLeaf.prototype
     * @returns {number}
     */
    computeHeight: function() {
        return 1;
    },

    /**
     * @memberOf DataNodeLeaf.prototype
     * @returns {Array}
     */
    getIndex: function() { // TODO: formerly getAllRowIndexes
        return this.index;
    },

    /**
     * @memberOf DataNodeLeaf.prototype
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
     * @memberOf DataNodeLeaf.prototype
     * @param drillDown
     */
    buildView: function(drillDown) {
        drillDown.addView(this);
    },

    /**
     * @memberOf DataNodeLeaf.prototype
     */
    toggleExpansionState: function() {
        //do nothing by default
    },

    sortGroups: function(groupSorter) {
    }
});


module.exports = DataNodeBase;
