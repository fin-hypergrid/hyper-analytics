'use strict';

var DataNodeBase = require('./DataNodeBase');

/**
 * See {@link DataBaseNode#initialize|initialize()} method for parameters.
 * @constructor
 */
var AggregatorNodeBase = DataNodeBase.extend('DataNodeBase', {

    /**
     * @memberOf DataNodeLeaf.prototype
     * @param aggregator
     */
    getRowData: function(aggregator) {
        var index = this.getIndex();

        if (index.length) {
            var groupsOffset = Number(aggregator.hasGroups());

            // redimension the data
            var data = this.data;
            data.length = groupsOffset + aggregator.aggregates.length;

            var sorter = aggregator.sorterInstance;
            sorter.index = index;

            aggregator.aggregates.forEach(function(aggregate, i) {
                data[groupsOffset + i] = aggregate(sorter);
            });
        }
    }
});

module.exports = AggregatorNodeBase;
