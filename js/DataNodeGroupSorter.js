'use strict';

var Base = require('./Base');
var stableSort = require('./util/stableSort').sort;

/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataNodeGroupSorter = Base.extend('DataNodeGroupSorter', {

    /**
     * @memberOf DataNodeGroupSorter#
     */
    initialize: function(dataSource) {
        this.dataSource = dataSource;
        this.sorts = [];

    },
    /**
     *  @memberOf DataSourceSorterComposite#
     *  @param columnIndex
     *  @param direction
     */

    sortOn: function(columnIndex, direction) {
        this.sorts.push({ columnIndex: columnIndex, direction: direction });
    },
    /**
     *
     * @memberOf DataNodeGroupSorter#
     * @param {sorterFunction} [sorter] - If undefined, deletes sorter.
     */
    set: function(sorter) {
        if (sorter) {
            /**
             * @implements sorterInterfacei
             * @memberOf DataSourceSorterComposite#
             */
            this.sorter = sorter;
        } else {
            delete this.sorter;
        }
    },

    get: function() {
        return this.sorter;
    },

    /**
     * @memberOf DataNodeGroupSorter#
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

        // get list of sorts from either API or use existing
        this.sorts = (this.sorter && this.sorter.prop('sorts')) || this.sorts;
        for (var i = this.sorts.length - 1; i >= 0; i--) {
            this.sortGroupOnEach(group, this.sorts[this.sorts.length - i - 1]);
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

Object.defineProperty(DataNodeGroupSorter.prototype, 'type', { value: 'sorter' }); // read-only property

module.exports = DataNodeGroupSorter;
