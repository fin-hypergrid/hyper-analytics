/* eslint-disable no-underscore-dangle */

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
     * @summary Turns tree view **on**.
     * @desc Calculates or recalculates nesting depth of each row and marks it as expandable if it has children.
     *
     * If resetting previously set data, the state of expansion of all rows that still have children is retained.
     *
     * All three named columns must exist.
     *
     * @param {boolean|object} [options] - If falsy (or omitted), turns tree view **off**.
     * @param {string} [options.ID='ID'] - Column name of the primary key column.
     * @param {string} [options.parentID='parentID'] - Column name of the foreign key column for grouping.
     * @param {string} [options.drilldown='name'] - Column name of the drilldown column to decorate.
     * @memberOf DataSourceSorter.prototype
     */
    setRelation: function(options) {
        var idColumnName, parentIdColumnName, treeColumnName, fields,
            rowCount, r, parentID, depth, leafRow, row, ID;

        this.treeColumnIndex = undefined;

        if (options) {
            fields = this.getFields();
            idColumnName = options.idColumnName || 'ID';
            parentIdColumnName = options.parentIdColumnName || 'parentID';
            treeColumnName = options.treeColumnName || 'name';

            if ( // all three columns must exist
                fields.indexOf(idColumnName) >= 0 &&
                fields.indexOf(parentIdColumnName) >= 0 &&
                fields.indexOf(treeColumnName) >= 0
            ) {
                this.idColumnName = idColumnName;
                this.parentIdColumnName = parentIdColumnName;
                this.treeColumnIndex = fields.indexOf(treeColumnName);
            }
        }

        if (this.treeColumnIndex !== undefined) {
            // mutate data row with __DEPTH and __EXPANDED
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

                leafRow.__DEPTH = depth;

                if (!this.findRow(parentIdColumnName, ID)) {
                    delete leafRow.__EXPANDED; // no longer expandable
                } else if (leafRow.__EXPANDED === undefined) { // retain previous setting for old rows
                    leafRow.__EXPANDED = false; // default for new row is unexpanded
                }
            }
        }

        return this.treeColumnIndex;
    },

    apply: function() {
        this.buildIndex(this.treeColumnIndex === undefined ? undefined : collapseRows);
    },

    getValue: function(x, y) {
        var value = DataSourceIndexed.prototype.getValue.call(this, x, y);

        if (x === this.treeColumnIndex) {
            var row = this.getRow(y),
                prefix = Array(row.__DEPTH + 1).join('    ') + expandedMap[row.__EXPANDED];
            value = prefix + value;
        }

        return value;
    },

    click: function(y) {
        var row = this.getRow(y);
        var expandable = row.__EXPANDED !== undefined;
        if (expandable) {
            row.__EXPANDED = !row.__EXPANDED;
        }
        return expandable;
    }

});

function collapseRows(r, row) {
    var parentID;
    while ((parentID = row[this.parentIdColumnName]) != undefined) { // eslint-disable-line eqeqeq
        row = this.findRow(this.idColumnName, parentID);
        if (row.__EXPANDED === false) {
            return false;
        }
    }
    return true;
}

module.exports = DataSourceTreeview;
