'use strict';

var Base = require('./Base');
var stableSort = require('./util/stableSort').sort;

/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataNodeGroupSorter = Base.extend('DataNodeGroupSorter', {

    /**
     * @memberOf DataSourceSorterComposite.prototype
     */
    initialize: function(dataSource) {
        this.dataSource = dataSource;
        this.sorts = [];

    },

    /**
     * @memberOf DataSourceSorterComposite.prototype
     * @param {number} y
     * @returns {Object}
     */
    getRow: function(y) {
        return this.last.getRow(y);
    },

    /**
     * @memberOf DataSourceSorterComposite.prototype
     * @param columnIndex
     * @param direction
     */
    sortOn: function(columnIndex, direction) {
        this.sorts.push([columnIndex, direction]);
    },

    /**
     * @memberOf DataSourceSorterComposite.prototype
     */
    apply: function() {
        this.dataSource.sortGroups(this);
    },

    /**
     * @memberOf DataSourceSorterComposite.prototype
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
        for (var i = 0; i < sorts.length; i++) {
            this.sortGroupOnEach(group, sorts[sorts.length - i - 1]);
        }
    },

    sortGroupOnEach: function(group, sortInfo) {
        // we actually sort the children here....
        var children = group.children.slice(0);
        var colIndex = sortInfo[0];
        var ascDesc = sortInfo[1];
        var indexVector = [];
        var i = 0;

        for (i = 0; i < children.length; i++) {
            indexVector[i] = i;
        }

        stableSort(indexVector, function(rowNumber) {
            var child = children[rowNumber];
            if (colIndex === 0) {
                return child.label;
            }
            return child.data[colIndex];
        }, ascDesc);

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
