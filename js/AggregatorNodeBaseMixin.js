'use strict';


var AggregatorNodeBaseMixin = {
    getRowData: function(aggregator) {
        var index = this.getIndex();

        if (index.length) {
            // redimension the data
            var data = this.data;
            data.length = aggregator.aggregates.length;

            var sorter = aggregator.sorterInstance;
            sorter.index = index;

            aggregator.aggregates.forEach(function(aggregate, i) {
                data[i] = aggregate(sorter);
            });
        }
    }
};

module.exports = AggregatorNodeBaseMixin;
