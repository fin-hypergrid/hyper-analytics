'use strict';

var AggregatorNodeBaseMixin = require('./AggregatorNodeBaseMixin');
var DataNodeGroup = require('./DataNodeGroup');

/**
 * @constructor
 * @extends DataNodeBase
 */
var AggregatorNodeGroup = DataNodeGroup.extend('AggregatorNodeGroup', AggregatorNodeBaseMixin);

module.exports = AggregatorNodeGroup;
