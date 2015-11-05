'use strict';

var DataNodeGroup = require('./DataNodeGroup');

var DataNodeTree = DataNodeGroup.extend({

    initialize: function(key) { // eslint-disable-line no-unused-vars
        this.height = 0;
        this.expanded = true;
    },

    prune: function() {
        this.children = this.children.values;
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.prune(0);
        }
    },

    buildView: function(aggregator) {
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.buildView(aggregator);
        }
    },

    computeHeight: function() {
        var height = 1;
        for (var i = 0; i < this.children.length; i++) {
            height = height + this.children[i].computeHeight();
        }
        this.height = height;

        return this.height;
    }

});

module.exports = DataNodeTree;