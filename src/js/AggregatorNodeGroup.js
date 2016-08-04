'use strict';

var AggregatorNodeBaseMixin = require('./AggregatorNodeBaseMixin');
var DataNodeGroup = require('./DataNodeGroup');

/**
 * @constructor
 * @extends DataNodeBase
 */
var AggregatorNodeGroup = DataNodeGroup.extend('AggregatorNodeGroup', {
    getRowData: function (drillDown) {
        AggregatorNodeBaseMixin.getRowData.apply(this, arguments);
        if (this.expanded) {
            this.children.forEach(function (child) {
                child.getRowData(drillDown);
            });
        }
    }
});

module.exports = AggregatorNodeGroup;
