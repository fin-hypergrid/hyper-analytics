'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');

var expandedMap = {
    true: '\u25bc ', // BLACK DOWN-POINTING TRIANGLE aka '▼'
    false: '\u25b6 ', // BLACK RIGHT-POINTING TRIANGLE aka '▶'
    undefined: '  ' // for leaf rows
};


/**
 * @constructor
 * @extends DataSourceIndexed
 */
var DataSourceTreeview = DataSourceIndexed.extend('DataSourceTreeview', {

    /**
     * @param {DataSource|DataSourceAggregator} dataSource
     * @param {string} options.ID - Column name of the primary key column.
     * @param {string} options.parentID - Column name of the foreign key column for grouping.
     * @param {string} options.drilldown - Column name of the drilldown column to decorate.
     * @memberOf DataSourceSorter.prototype
     */
    initialize: function(dataSource, options) {
        var rowCount, r, parentID, depth, leafRow, row, ID,
            idColumnName = this.idColumnName = options.idColumnName || 'ID',
            parentIdColumnName = this.parentIdColumnName = options.parentIdColumnName || 'parentID',
            treeColumnName = options.treeColumnName || 'name';

        this.treeColumnIndex = options.treeColumnIndex = this.getFields().indexOf(treeColumnName);

        // mutate data row with meta vars (which start with $$)
        rowCount = this.getRowCount();
        r = rowCount;
        while (r--) {
            depth = -1;
            leafRow = this.getRow(r);
            row = leafRow;
            ID = row[idColumnName];

            do {
                parentID = row[parentIdColumnName];
                row = this.findRow(idColumnName, parentID);
                ++depth;
            } while (parentID != undefined); // eslint-disable-line eqeqeq

            leafRow.$$DEPTH = depth;
            if (this.findRow(parentIdColumnName, ID)) {
                leafRow.$$EXPANDED = false;
            }
        }
    },

    apply: function() {
        this.buildIndex(function applyFilter(r, rowObject) {
            var parentID = rowObject[this.parentIdColumnName];
            return !rowObject.$$DEPTH || this.findRow(this.idColumnName, parentID).$$EXPANDED;
        });
    },

    getValue: function(x, y) {
        var value = DataSourceIndexed.prototype.getValue.call(this, x, y);

        if (x === this.treeColumnIndex) {
            var row = this.getRow(y),
                prefix = Array(row.$$DEPTH + 1).join('    ') + expandedMap[row.$$EXPANDED];
            value = prefix + value;
        }

        return value;
    },

    click: function(y) {
        var row = this.getRow(y);
        if (row.$$EXPANDED !== undefined) {
            row.$$EXPANDED = !row.$$EXPANDED;
        }
    }

});

module.exports = DataSourceTreeview;
