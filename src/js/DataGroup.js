'use strict';

var Map = require('./map');

module.exports = (function() {

    var ExpandedMap = {
        true: '▾',
        false: '▸'
    };
    var depthString = '                                                                                ';

    function DataGroup(key) {
        this.label = key;
        this.data = [''];
        this.children = new Map();
        this.hasChildren = true;
        this.expanded = false;
        this.depth = 0;
        this.height = 1;
        this.parent;
        this.rowIndexes = [];
        this.displayString = '';
    }

    DataGroup.prototype.getAllRowIndexes = function() {
        if (this.rowIndexes.length === 0) {
            this.rowIndexes = this.computeAllRowIndexes();
        }
        return this.rowIndexes;
    };

    DataGroup.prototype.computeAllRowIndexes = function() {
        var result = [];
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            var childIndexes = child.getAllRowIndexes();
            Array.prototype.splice.apply(result, [result.length, 0].concat(childIndexes));
        }
        return result;
    };

    DataGroup.prototype.toggleExpansionState = function(aggregator) {
        this.expanded = !this.expanded;
        this.data[0] = this.computeDepthString();
    };

    DataGroup.prototype.computeAggregates = function(aggregator) {
        this.applyAggregates(aggregator);
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].computeAggregates(aggregator);
        }
    };

    DataGroup.prototype.applyAggregates = function(aggregator) {
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

    DataGroup.prototype.getRowCount = function() {
        return this.children.length;
    };

    DataGroup.prototype.getValue = function(x) {
        return this.data[x];
    };

    DataGroup.prototype.prune = function(depth) {
        this.depth = depth;
        this.children = this.children.values;
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.parent = this;
            child.prune(this.depth + 1);
        }
        this.data[0] = this.computeDepthString();
    };

    DataGroup.prototype.computeDepthString = function() {
        var icon = ExpandedMap[this.expanded + ''];
        var string = depthString.substring(0, this.depth * 3) + icon + ' ' + this.label + '     |';
        return string;
    };

    DataGroup.prototype.buildView = function(aggregator) {
        aggregator.view.push(this);
        if (this.expanded) {
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i];
                child.buildView(aggregator);
            }
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
