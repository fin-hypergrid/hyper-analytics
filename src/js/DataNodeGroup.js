'use strict';

var Map = require('./util/Mappy');
var DataNodeBase = require('./DataNodeBase');

var expandedMap = {
    true: '\u25bc', // BLACK DOWN-POINTING TRIANGLE aka '▼'
    false: '\u25b6' // BLACK RIGHT-POINTING TRIANGLE aka '▶'
};

/**
 * > See {@link DataNodeGroup#initialize|initialize()} method for constructor parameters.
 * @constructor
 * @extends DataNodeBase
 */
var DataNodeGroup = DataNodeBase.extend('DataNodeGroup', {

    extendable: true,

    /**
     * @memberOf DataNodeGroup.prototype
     * @param key
     */
    initialize: function(key) {
        this.children = new Map();
    },

    /**
     * @memberOf DataNodeGroup.prototype
     * @param depth
     */
    toArray: function(depth) {
        this.depth = depth;
        this.children = this.children.values;
        this.children.forEach(function(child) {
            child.toArray(depth + 1);
        });
        this.data[0] = this.computeDepthString();
    },

    /**
     * @memberOf DataNodeGroup.prototype
     * @returns {string}
     */
    computeDepthString: function() {
        var string = Array(this.depth + 1).join(this.INDENT) +
            expandedMap[this.expanded] + ' ' +
            this.label;
        return string;
    },

    /**
     * @memberOf DataNodeGroup.prototype
     * @returns {*}
     */
    getIndex: function() {
        if (this.index.length === 0) {
            this.index = this.computeIndex();
        }
        return this.index;
    },

    /**
     * @memberOf DataNodeGroup.prototype
     * @returns {Array}
     */
    computeIndex: function() { // TODO: formerly computeAllRowIndexes
        var result = [];
        result.append = append;
        this.children.forEach(function(child) {
            result.append(child.getIndex());
        });
        return result;
    },

    /**
     * @memberOf DataNodeGroup.prototype
     * @param aggregator
     * @param {boolean} [expand] - If omitted, toggles state.
     * @returns {boolean} If this call resulted in a state change.
     */
    toggleExpansionState: function(aggregator, expand) { /* aggregator */
        if (expand === undefined) {
            expand = !this.expanded;
        }
        var changed = this.expanded ^ expand;
        this.expanded = expand;
        this.data[0] = this.computeDepthString();
        if (this.expanded) {
            this.computeAggregates(aggregator);
        }
        return !!changed;
    },

    /**
     * @memberOf DataNodeGroup.prototype
     * @param aggregator
     */
    computeAggregates: function(aggregator) {
        DataNodeBase.prototype.computeAggregates.call(this, aggregator); // call base class's version
        if (this.expanded) {
            this.children.forEach(function(child) {
                child.computeAggregates(aggregator);
            });
        }
    },

    /**
     * @memberOf DataNodeGroup.prototype
     * @param aggregator
     */
    buildView: function(aggregator) {
        aggregator.view.push(this);
        if (this.expanded) {
            this.children.forEach(function(child) {
                child.buildView(aggregator);
            });
        }
    },

    /**
     * @memberOf DataNodeGroup.prototype
     * @returns {number}
     */
    computeHeight: function() {
        var height = 1;

        if (this.expanded) {
            this.children.forEach(function(child) {
                height = height + child.computeHeight();
            });
        }

        return (this.height = height);
    },

    sortWith: function(sorter) {
        if (this.expanded) {
            sorter.sortGroup(this);
            this.children.forEach(function(child) {
                child.sortWith(sorter);
            });
        }
    },
    clearGroupSorts: function() {
        if (this.originalOrder) {
            for (var i = 0; i < this.originalOrder.length; i++) {
                this.children[i] = this.originalOrder[i];
            }
        }
        this.children.forEach(function(child) {
            child.clearGroupSorts();
        });
    }

});

/**
 * @private
 * @summary Array mixin to append another array to end of `this` one.
 * @desc Appends in place, unlike `this.concat()` which creates a new array.
 * Uses less memory than concat, important when `appendix` is huge.
 * > CAUTION: Mutates `this` array!
 * @param {Array} appendix
 * @returns {Array} Reference to `this` (for convenience)
 */
function append(appendix) {
    this.splice.bind(this, this.length, 0).apply(this, appendix);
    return this;
}

module.exports = DataNodeGroup;
