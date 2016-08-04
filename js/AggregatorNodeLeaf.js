'use strict';

var AggregatorNodeBaseMixin = require('./AggregatorNodeBaseMixin');
var DataNodeLeaf = require('./DataNodeLeaf');

/**
 * @constructor
 * @extends DataNodeBase
 */
var AggregatorNodeLeaf = DataNodeLeaf.extend('AggregatorNodeLeaf', AggregatorNodeBaseMixin);

module.exports = AggregatorNodeLeaf;
