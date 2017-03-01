'use strict';

var DataNodeBase = require('./DataNodeBase');

/**
 * @constructor
 * @extends DataNodeBase
 */
var DataNodeLeaf = DataNodeBase.extend('DataNodeLeaf', {

    /**
     * @memberOf DataNodeLeaf#
     * @param {string} key
     */
    initialize: function(key) {
        this.hasChildren = false;
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
     * @returns {numer[]}
     */
    getIndex: function() {
        return this.index;
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
     * @param aggregator
     */
    getRowData: function(drillDown) {
        var index = this.getIndex();

        if (index.length) {
            var sorter = drillDown.sorterInstance,
                data = this.data,
                dataLen = sorter.getColumnCount(),
                i = 0;

            sorter.index = index;
            for (i; i < dataLen; i++) {
                data[i] = sorter.getValue(i, 0);
            }
        }
    },

    /**
     * @memberOf DataNodeLeaf#
     * @returns {number}
     */
    computeHeight: function() {
        return 1;
    },

    sortWith: function(sorter) {
      // do nothing we have no children to sort
    },

    clearGroupSorts: function() {
      // do nothing we have no children to sort
    }

});

module.exports = DataNodeLeaf;
