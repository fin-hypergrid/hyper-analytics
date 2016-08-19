'use strict';

var Base = require('./Base');
var stableSort = require('./util/stableSort').sort;

/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataNodeGroupSorter = Base.extend('DataNodeGroupSorter', {

    /**
     * @memberOf DataSourceSorterComposite#
     */
    initialize: function(dataSource) {
        this.dataSource = dataSource;
        this.sorts = [];

    },

    /**
     * @memberOf DataSourceSorterComposite#
     * @param {number} y
     * @returns {Object}
     */
    getRow: function(y) {
        return this.last.getRow(y);
    },

    /**
     * @memberOf DataSourceSorterComposite#
     * @param columnIndex
     * @param direction
     */
    sortOn: function(columnIndex, direction) {
        this.sorts.push({ columnIndex: columnIndex, direction: direction });
    },

    set: function(sorts) {
        this.sorts = sorts || [];
    },

    /**
     * @memberOf DataSourceSorterComposite#
     */
    apply: function() {
        this.dataSource.sortGroups(this);
    },

    /**
     * @memberOf DataSourceSorterComposite#
     */
    clearSorts: function() {
        this.sorts.length = 0;
        this.dataSource.buildView();
    },

    sortGroup: function(group) {
        if (!group.originalOrder) {
            group.originalOrder = group.children.slice(0);
        }
        var sorts = this.sorts;
        for (var i = sorts.length - 1; i >= 0; i--) {
            this.sortGroupOnEach(group, sorts[sorts.length - i - 1]);
        }
    },

    sortGroupOnEach: function(group, sortSpec) {
        // we actually sort the children here....
        var children = group.children.slice(0);
        var indexVector = [];

        for (var i = 0; i < children.length; i++) {
            indexVector[i] = i;
        }

        stableSort(indexVector, function(rowNumber) {
            var child = children[rowNumber];
            if (sortSpec.columnIndex === 0) {
                return child.label;
            }
            return child.data[sortSpec.columnIndex];
        }, sortSpec.direction);

        for (i = 0; i < children.length; i++) {
            group.children[i] = children[indexVector[i]];
        }
    }

});

DataNodeGroupSorter.prototype.applySorts = function() {
    (console.warn || console.log).call(console, 'applySorts deprecated; use apply');
    this.apply();
};

module.exports = DataNodeGroupSorter;
