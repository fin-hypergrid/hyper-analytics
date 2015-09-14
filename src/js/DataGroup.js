'use strict';

var Map = require('./map');

module.exports = (function() {

    function DataGroup(key) {
        this.label = key;
        this.data = [];
        this.children = new Map();
        this.hasChildren = true;
        this.expanded = false;
        this.depth = 0;
        this.height = 1;
        this.parent;
        this.rowIndexes = [];
    }

    DataGroup.prototype.computeAggregates = function(aggregator) {
        var hasChildLeafs = !this.children[0].hasChildren;
        if (hasChildLeafs) { // are my children leafs?
            this.applyAggregates(aggregator);
        } else {
            for (var i = 0; i < this.children.length; i++) {
                this.children[i].computeAggregates(aggregator);
            }
        }
    };

    DataGroup.prototype.getAllRowIndexes = function() {
        if (this.rowIndexes.length === 0) {
            this.rowIndexes = this.computeAllRowIndexes();
        }
        return this.rowIndexes;
    };

    DataGroup.prototype.computeAllRowIndexes = function() {
        var hasChildLeafs = !this.children[0].hasChildren;
        if (hasChildLeafs) {
            var indexes = this.children.map(function(e) { return e.rowIndex; });
            return indexes;
        } else {
            var result = [];
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i];
                var childIndexes = child.getAllRowIndexes();
                Array.prototype.splice.apply(result, [1,0].concat(childIndexes));
            }
            return result;
        }
    };

    DataGroup.prototype.applyAggregates = function(aggregator) {
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
        this.parent.doRollups(this, aggregator);
    };

    DataGroup.prototype.doRollups = function(child, aggregator) {
        var isChildTheLastOne = this.children[this.children.length - 1] !== child;
        if (isChildTheLastOne) {
            return;
        }
        this.applyAggregates(aggregator);
    };

    DataGroup.prototype.getRowCount = function() {
        return this.children.length;
    };

    DataGroup.prototype.getValue = function(x, y) {
        return this.data[y][x];
    };

    DataGroup.prototype.prune = function(depth) {
        this.depth = depth;
        this.children = this.children.values;
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.parent = this;
            child.prune(this.depth + 1);
        }
    };

    DataGroup.prototype.computeHeight = function() {
        var height = 1; //I'm 1 high
        if (!this.expanded) {
            this.height = 1;
        } else {
            for (var i = 0; i < this.children.length; i++) {
                height = height + this.children[i].computeHeight();
            }
            this.height = height;
        }
        return this.height;
    };

    return DataGroup;

})();
