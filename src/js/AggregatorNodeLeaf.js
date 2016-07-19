'use strict';

var AggregatorNodeBase = require('./AggregatorNodeBase');

/**
 * @constructor
 * @extends DataNodeBase
 */
var AggregatorNodeLeaf = AggregatorNodeBase.extend('AggregatorNodeLeaf', {

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
     * @returns {numer[]}
     */
    getIndex: function() {
        return this.index;
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

module.exports = AggregatorNodeLeaf;
