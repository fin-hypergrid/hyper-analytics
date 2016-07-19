'use strict';

var AggregatorNodeBaseMixin = require('./AggregatorNodeBaseMixin');
var DataNodeTree = require('./DataNodeTree');

/**
 * @constructor
 * @extends DataNodeBase
 */
var AggregatorNodeTree = DataNodeTree.extend('AggregatorNodeTree', AggregatorNodeBaseMixin);

module.exports = AggregatorNodeTree;
