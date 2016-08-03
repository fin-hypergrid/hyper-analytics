'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');

var expandedMap = {
    true: '\u25bc ', // BLACK DOWN-POINTING TRIANGLE aka '▼'
    false: '\u25b6 ', // BLACK RIGHT-POINTING TRIANGLE aka '▶'
    undefined: '  ' // for leaf rows
};

/**
 * For proper sorting, include `DataSourceTreeviewSorter` in your pipeline, _ahead of_ (closer to the data than) this data source.
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
     * @returns {boolean} Joined state.
     * @memberOf DataSourceTreeview.prototype
     */
    setRelation: function(options) {
        var idColumnName, parentIdColumnName, treeColumnName, fields,
            r, parentID, depth, leafRow, row, ID;

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

                // treeviewSorter needs to know following for access by each DataSourceSorter it creates:
                this.dataSource.idColumnName = idColumnName;
                this.dataSource.parentIdColumnName = parentIdColumnName;
            }
        }

        this.buildIndex(); // make all rows visible to getRow()

        r = this.getRowCount();
        if (this.joined) {
            // mutate data row with __DEPTH (all rows) and __EXPANDED (all "parent" rows)
            while (r--) {
                depth = 0;
                leafRow = this.getRow(r);
                row = leafRow;
                ID = row[idColumnName];

                while ((parentID = row[parentIdColumnName]) != undefined) { // eslint-disable-line eqeqeq
                    row = this.findRow(idColumnName, parentID);
                    ++depth;
                }

                leafRow.__DEPTH = depth;

                if (!this.findRow(parentIdColumnName, ID)) {
                    delete leafRow.__EXPANDED; // no longer expandable
                } else if (leafRow.__EXPANDED === undefined) { // retain previous setting for old rows
                    leafRow.__EXPANDED = false; // default for new row is unexpanded
                }
            }
        } else {
            // flatten the tree so group sorter sees it as a single group
            while (r--) {
                this.getRow(r).__DEPTH = 0;
            }
        }

        return this.joined;
    },

    /**
     * @memberOf DataSourceTreeview.prototype
     */
    apply: function() {
        if (this.viewMakesSense()) {
            this.buildIndex(this.treeColumnIndex === undefined ? undefined : rowIsRevealed);
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
     * * number > 0 - Apply only if row depth is above the given depth.
     * * number <= 0 - Apply only if row depth is below the given depth.
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
        if (row && row.__EXPANDED !== undefined) {
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

function rowIsRevealed(r, row) {
    var parentID;

    // are any of the row's ancestors collapsed?
    while ((parentID = row[this.parentIdColumnName]) != undefined) { // eslint-disable-line eqeqeq
        // walk up through each parent...
        row = this.findRow(this.idColumnName, parentID);
        if (row.__EXPANDED === false) { // an ancestor is collapsed
            return false; // exclude row from build
        }
    }

    // no ancestors were collapsed
    return true; // include row in build
}

module.exports = DataSourceTreeview;
