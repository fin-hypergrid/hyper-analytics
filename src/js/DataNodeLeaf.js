'use strict';

var DataNodeBase = require('./DataNodeBase');

var DataNodeLeaf = DataNodeBase.extend({

    prune: function(depth) {
        this.depth = depth;
        this.data[0] = this.computeDepthString();
    },

    getAllRowIndexes: function() {
        return this.rowIndexes;
    },

    computeAggregates: function(aggregator) {
        this.applyAggregates(aggregator);
    },

    buildView: function(aggregator) {
        aggregator.view.push(this);
    },

    computeHeight: function() {
        return 1;
    }

});

module.exports = DataNodeLeaf;