'use strict';

var Map = require('./map');

module.exports = (function() {

    function DataTree() {
        this.label = 'root';
        this.children = new Map();
        this.hasChildren = true;
        this.height = 0;
        this.depth = 0;
        this.data = [];
        this.rowIndexes = [];
    }

    DataTree.prototype.computeAggregates = function(aggregator) {
        this.applyAggregates(aggregator);
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].computeAggregates(aggregator);
        }
    };

    DataTree.prototype.prune = function() {
        this.children = this.children.values;
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.prune(0);
        }
    };

    DataTree.prototype.computeHeight = function() {
        var height = 0;
        for (var i = 0; i < this.children.length; i++) {
            height = height + this.children[i].computeHeight();
        }
        this.height = height;

        return this.height;
    };

    DataTree.prototype.buildView = function(aggregator) {
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.buildView(aggregator);
        }
    };

    DataTree.prototype.applyAggregates = function(aggregator) {
        var aggregates = aggregator.aggregates;
        var data = this.data;
        data.length = aggregates.length;
        var indexes = this.getAllRowIndexes();
        var sorter = aggregator.sorterInstance;
        sorter.indexes = indexes;

        for (var i = 0; i < aggregates.length; i++) {
            var aggregate = aggregates[i];
            data[i] = aggregate(sorter);
        }

        this.data = data;
    };

    DataTree.prototype.getAllRowIndexes = function() {
        if (this.rowIndexes.length === 0) {
            this.rowIndexes = this.computeAllRowIndexes();
        }
        return this.rowIndexes;
    };

    DataTree.prototype.computeAllRowIndexes = function() {
        var result = [];
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            var childIndexes = child.getAllRowIndexes();
            Array.prototype.splice.apply(result, [result.length, 0].concat(childIndexes));
        }
        return result;
    };

    return DataTree;

})();
