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

    /** DataSourceTreeviewSorter needs access to this object for instance variables `joined`, `idColumn`, and `parentIdColumn`, these last two of which are passed to the DataSourceDepthSorter constructor. (If dataSource is not the sorter, this is not used but harmless.)
     * @param dataSource
     * @memberOf DataSourceTreeview.prototype
     */
    initialize: function(dataSource) {
        dataSource.treeView = this;
    },

    /**
     * @summary Toggle the tree-view.
     * @desc Calculates or recalculates nesting depth of each row and marks it as expandable if it has children.
     *
     * If resetting previously set data, the state of expansion of all rows that still have children is retained.
     *
     * All three named columns must exist.
     *
     * @param {boolean|object} [options] - Turn tree-view **ON**. If falsy (or omitted), turn it **OFF**.
     * @param {number|string} [options.idColumn='ID'] - Name or index of the primary key column.
     * @param {number|string} [options.parentIdColumn='parentID'] - Name or index of the foreign key column for grouping.
     * @param {number|string} [options.treeColumn='name'] - Name or index of the drill-down column to decorate.
     * @returns {boolean} Joined state.
     * @memberOf DataSourceTreeview.prototype
     */
    setRelation: function(options) {
        var r, parentID, depth, leafRow, row, ID;

        // successful join requires that options object be given and that all three columns exist
        this.joined = !!(
            options &&
            (this.idColumn = this.getColumnInfo(options.idColumn, 'ID')) &&
            (this.parentIdColumn = this.getColumnInfo(options.parentIdColumn, 'parentID')) &&
            (this.treeColumn = this.getColumnInfo(options.treeColumn, 'name')) &&
            (this.groupColumn = this.getColumnInfo(options.groupColumn, this.treeColumn.name))
        );

        this.buildIndex(); // make all rows visible to getRow()

        r = this.getRowCount();
        if (this.joined) {
            // mutate data row with __DEPTH (all rows) and __EXPANDED (all "parent" rows)
            var idColumnName = this.idColumn.name,
                parentIdColumnName = this.parentIdColumn.name;

            this.maxDepth = 0;

            while (r--) {
                depth = 0;
                leafRow = this.getRow(r);
                row = leafRow;
                ID = row[idColumnName];

                while ((parentID = row[parentIdColumnName]) != undefined) { // eslint-disable-line eqeqeq
                    row = this.findRow(idColumnName, parentID);
                    ++depth;
                }

                if (this.maxDepth < depth) {
                    this.maxDepth = depth;
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
            this.buildIndex(this.joined && rowIsRevealed);
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

        if (this.viewMakesSense() && x === this.treeColumn.index) {
            var row = this.getRow(y);

            if (!(value === '' && row.__EXPANDED === undefined)) {
                value = Array(row.__DEPTH + 1).join('   ') + expandedMap[row.__EXPANDED] + value;
            }
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
        while ((row = this.findRow(this.idColumn.name, ID))) {
            if (parent && row.__EXPANDED === false) {
                row.__EXPANDED = changed = true;
            }
            parent = true;
            ID = row[this.parentIdColumn.name];
        }
        return changed;
    }
});

function rowIsRevealed(r, row) {
    var parentID;

    // are any of the row's ancestors collapsed?
    while ((parentID = row[this.parentIdColumn.name]) != undefined) { // eslint-disable-line eqeqeq
        // walk up through each parent...
        row = this.findRow(this.idColumn.name, parentID);
        if (row.__EXPANDED === false) { // an ancestor is collapsed
            return false; // exclude row from build
        }
    }

    // no ancestors were collapsed
    return true; // include row in build
}

module.exports = DataSourceTreeview;
