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
     * @memberOf DataNodeGroup#
     * @param key
     */
    initialize: function(key) {
        this.children = new Map();
    },

    /**
     * @memberOf DataNodeGroup#
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
     * @memberOf DataNodeGroup#
     * @returns {string}
     */
    computeDepthString: function() {
        var string = Array(this.depth + 1).join(this.INDENT) +
            expandedMap[this.expanded] + ' ' +
            this.label;
        return string;
    },

    /**
     * @memberOf DataNodeGroup#
     * @returns {*}
     */
    getIndex: function() {
        if (this.index.length === 0) {
            this.index = this.computeIndex();
        }
        return this.index;
    },

    /**
     * @memberOf DataNodeGroup#
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
     * @memberOf DataNodeGroup#
     * @param drillDown
     * @param {boolean} [expand] - One of:
     * * `true` - Expand all rows that are currently collapsed.
     * * `false` - Collapse all rows that are currently expanded.
     * * `undefined` (or omitted) - Expand all currently collapsed rows; collapse all currently expanded rows.
     * @returns {boolean} If this call resulted in a state change.
     */
    toggleExpansionState: function(drillDown, expand) { /* aggregator */
        if (expand === undefined) {
            expand = !this.expanded;
        }
        var changed = this.expanded ^ expand;
        this.expanded = expand;
        this.data[0] = this.computeDepthString();
        if (this.expanded) {
            this.getRowData(drillDown);
        }
        return !!changed;
    },

    /**
     * @memberOf DataNodeGroup#
     * @param drillDown
     */
    getRowData: function(drillDown) {
        DataNodeBase.prototype.getRowData.call(this, drillDown); // call base class's version
        if (this.expanded) {
            this.children.forEach(function(child) {
                child.getRowData(drillDown);
            });
        }
    },

    /**
     * @memberOf DataNodeGroup#
     * @param aggregator
     */
    buildView: function(drillDown) {
        drillDown.view.push(this);
        if (this.expanded) {
            this.children.forEach(function(child) {
                child.buildView(drillDown);
            });
        }
    },

    /**
     * @memberOf DataNodeGroup#
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
