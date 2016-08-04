'use strict';

var AggregatorNodeBaseMixin = require('./AggregatorNodeBaseMixin');
var DataNodeTree = require('./DataNodeTree');

/**
 * @constructor
 * @extends DataNodeBase
 */
var AggregatorNodeTree = DataNodeTree.extend('AggregatorNodeTree', {
    getRowData: function (drillDown) {
        AggregatorNodeBaseMixin.getRowData.apply(this, arguments);
        if (this.expanded) {
            this.children.forEach(function (child) {
                child.getRowData(drillDown);
            });
        }
    }
});

module.exports = AggregatorNodeTree;
