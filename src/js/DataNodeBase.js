'use strict';

var extendify = require('./util/extend').extendify;

function DataNodeBase(key) {
    this.initialize(key);
}

DataNodeBase.prototype = {

    constructor: DataNodeBase.prototype.constructor, // preserve constructor

    isNullObject: false,

    initialize: function(key) {
        this.label = key;
        this.data = [''];
        this.rowIndexes = [];
        this.hasChildren = false;
        this.depth = 0;
        this.height = 1;
        this.expanded = false;
    },

    getValue: function(x) {
        return this.data[x];
    },

    prune: function(depth) {
        this.depth = depth;
        this.data[0] = this.computeDepthString();
    },

    computeDepthString: function() {
        return Array(3 * this.depth + 3).join(' ') + this.label;
    },

    computeHeight: function() {
        return 1;
    },

    getAllRowIndexes: function() {
        return this.rowIndexes;
    },

    computeAggregates: function(aggregator) {
        this.applyAggregates(aggregator);
    },

    applyAggregates: function(aggregator) {
        var hasGroupsOffset = aggregator.hasGroups() ? 1 : 0;
        var indexes = this.getAllRowIndexes();
        if (indexes.length === 0) {
            return; // no data to rollup on
        }
        var aggregates = aggregator.aggregates;
        var data = this.data;
        data.length = aggregates.length + hasGroupsOffset;

        var sorter = aggregator.sorterInstance;
        sorter.indexes = indexes;

        for (var i = 0; i < aggregates.length; i++) {
            var aggregate = aggregates[i];
            data[i + hasGroupsOffset] = aggregate(sorter);
        }

        this.data = data;
    },

    buildView: function(aggregator) {
        aggregator.view.push(this);
    },

    toggleExpansionState: function() { /* aggregator */
        //do nothing by default
    }

};

extendify(DataNodeBase);

module.exports = DataNodeBase;