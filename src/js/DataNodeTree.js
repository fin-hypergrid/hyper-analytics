'use strict';

var DataNodeGroup = require('./DataNodeGroup');

/**
 * See {@link DataNodeGroup#initialize|initialize()} method for parameters.
 * @constructor
 * @extends DataNodeGroup
 */
var DataNodeTree = DataNodeGroup.extend('DataNodeTree', {

    /**
     * @memberOf DataNodeGroup.prototype
     * @param {string} key
     */
    initialize: function(key) {
        this.height = 0;
        this.expanded = true;
    },

    /**
     * @memberOf DataNodeGroup.prototype
     */
    toArray: function() {
        this.children = this.children.values;
        this.children.forEach(function(child) {
            child.toArray(0);
        });
    },

    /**
     * @memberOf DataNodeGroup.prototype
     * @param aggregator
     */
    buildView: function(aggregator) {
        this.children.forEach(function(child) {
            child.buildView(aggregator);
        });
    },

    /**
     * @memberOf DataNodeGroup.prototype
     * @returns {number}
     */
    computeHeight: function() {
        var height = 1;

        this.children.forEach(function(child) {
            height = height + child.computeHeight();
        });

        return (this.height = height);
    }

});

module.exports = DataNodeTree;
