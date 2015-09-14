'use strict';

var Map = require('./map');

module.exports = (function() {

    var depthString = '                                                                                ';

    function DataLeaf(key) {
        this.label = key;
        this.rowIndexes = [];
        this.hasChildren = false;
        this.depth = 0;
        this.height = 1;
        this.data = [''];
    };

    DataLeaf.prototype.getValue = function(x) {
        return this.data[x];
    };

    DataLeaf.prototype.prune = function(depth) {
        this.depth = depth;
        this.data[0] = this.computeDepthString();
    };

    DataLeaf.prototype.computeDepthString = function() {
        var string = depthString.substring(0, this.depth * 3) + this.label;
        return string;
    };

    DataLeaf.prototype.computeHeight = function() {
        return 1;
    };

    DataLeaf.prototype.getAllRowIndexes = function() {
        return this.rowIndexes;
    };

    DataLeaf.prototype.computeAggregates = function(aggregator) {
        this.applyAggregates(aggregator);
    };

    DataLeaf.prototype.applyAggregates = function(aggregator) {
        var aggregates = aggregator.aggregates;
        var data = this.data;
        data.length = aggregates.length + 1;
        var indexes = this.getAllRowIndexes();
        var sorter = aggregator.sorterInstance;
        sorter.indexes = indexes;

        for (var i = 0; i < aggregates.length; i++) {
            var aggregate = aggregates[i];
            data[i + 1] = aggregate(sorter);
        }

        this.data = data;
    };

    DataLeaf.prototype.buildView = function(aggregator) {
        aggregator.view.push(this);
    };

    return DataLeaf;

})();
