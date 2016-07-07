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
     * @summary Toggle the tree-view.
     * @desc Calculates or recalculates nesting depth of each row and marks it as expandable if it has children.
     *
     * If resetting previously set data, the state of expansion of all rows that still have children is retained.
     *
     * All three named columns must exist.
     *
     * @param {boolean|object} [options] - Turn tree-view **ON**. If falsy (or omitted), turn it **OFF**.
     * @param {string} [options.idColumnName='ID'] - Column name of the primary key column.
     * @param {string} [options.parentIdColumnName='parentID'] - Column name of the foreign key column for grouping.
     * @param {string} [options.treeColumnName='name'] - Column name of the drill-down column to decorate.
     * @memberOf DataSourceTreeview.prototype
     */
    setRelation: function(options) {
        var idColumnName, parentIdColumnName, treeColumnName, fields,
            rowCount, r, parentID, depth, leafRow, row, ID;

        this.joined = false;

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
                this.idColumnIndex = fields.indexOf(idColumnName);

                this.parentIdColumnName = parentIdColumnName;
                this.parentIdColumnIndex = fields.indexOf(parentIdColumnName);

                this.treeColumnName = treeColumnName;
                this.treeColumnIndex = fields.indexOf(treeColumnName);

                this.joined = this.treeColumnIndex !== undefined;
            }
        }

        this.buildIndex(); // make all rows visible to getRow()

        if (this.joined) {
            // mutate data row with __DEPTH (all rows) and __EXPANDED (all "parent" rows)
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
    },

    /**
     * @memberOf DataSourceTreeview.prototype
     */
    apply: function() {
        if (this.viewMakesSense()) {
            this.buildIndex(this.treeColumnIndex === undefined ? undefined : collapseRows);
        }
    },

    /**
     * @param x
     * @param y
     * @returns {*}
     * @memberOf DataSourceTreeview.prototype
     */
    getValue: function(x, y) {
        var value = DataSourceIndexed.prototype.getValue.call(this, x, y);

        if (this.viewMakesSense() && x === this.treeColumnIndex) {
            var row = this.getRow(y),
                prefix = Array(row.__DEPTH + 1).join('    ') + expandedMap[row.__EXPANDED];
            value = prefix + value;
        }

        return value;
    },

    viewMakesSense: function() {
        return this.joined;
    },

    /**
     * @desc Operates only on the following rows:
     * * Expandable rows - Rows with a drill-down control.
     * * Revealed rows - Rows not hidden inside of collapsed drill-downs.
     * @param y - Revealed row number. (This is not the row ID.)
     * @param {boolean} [expand] - One of:
     * * `true` - Expand all rows that are currently collapsed.
     * * `false` - Collapse all rows that are currently expanded.
     * * `undefined` (or omitted) - Expand all currently collapsed rows; collapse all currently expanded rows.
     * @param {number} [depth=Infinity] - One of:
     * * number > 0 - Apply only to rows above the given depth.
     * * number <= 0 - Apply only to rows at or below the given depth.
     * @returns {undefined|boolean} One of:
     * * `undefined` - Row was not expandable.
     * * `true` - Row had drill-down _and_ state changed.
     * * `false` - Row had drill-down _but_ state did _not_ change.
     * @memberOf DataSourceTreeview.prototype
     */
    click: function(y, expand, depth) {
        if (!this.viewMakesSense()) {
            return this.dataSource.click.apply(this.dataSource, arguments);
        }
        var changed, row = this.getRow(y);
        if (row.__EXPANDED !== undefined) {
            if (depth !== undefined && (
                depth > 0 && row.__DEPTH >= depth ||
                depth <= 0 && row.__DEPTH < -depth
            )) {
                changed = false;
            } else {
                if (expand === undefined) {
                    expand = !row.__EXPANDED;
                }
                changed = row.__EXPANDED && !expand || !row.__EXPANDED && expand;
                row.__EXPANDED = expand;
            }
        }
        return changed;
    },

    /**
     * @summary Expand nested drill-downs containing this row.
     * @param ID - The unique row ID.
     * @returns {boolean} If any rows expanded.
     */
    revealRow: function(ID) {
        if (!this.viewMakesSense()) {
            return this.dataSource.revealRow.apply(this.dataSource, arguments);
        }

        var row, parent, changed = false;
        while ((row = this.findRow(this.idColumnName, ID))) {
            if (parent && row.__EXPANDED === false) {
                row.__EXPANDED = changed = true;
            }
            parent = true;
            ID = row[this.parentIdColumnName];
        }
        return changed;
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
