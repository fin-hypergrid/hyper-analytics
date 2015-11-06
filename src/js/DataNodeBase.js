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
        this.index = []; // TODO: formerly rowIndex
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

    getIndex: function() { // TODO: formerly getAllRowIndexes
        return this.index;
    },

    applyAggregates: function(aggregator) {
        var index = this.getIndex();

        if (index.length) {
            var groupsOffset = Number(aggregator.hasGroups());

            // redimension the data
            var data = this.data;
            data.length = aggregator.aggregates.length + groupsOffset;

            var sorter = aggregator.sorterInstance;
            sorter.index = index;

            aggregator.aggregates.forEach(function(aggregate, i) {
                data[i + groupsOffset] = aggregate(sorter);
            });
        }
    },

    buildView: function(aggregator) {
        aggregator.addView(this);
    },

    toggleExpansionState: function() { /* aggregator */
        //do nothing by default
    }

};

DataNodeBase.prototype.computeAggregates = DataNodeBase.prototype.applyAggregates;

extendify(DataNodeBase);

module.exports = DataNodeBase;