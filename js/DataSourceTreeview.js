'use strict';

var DataSourceIndexed = require('./DataSourceIndexed');

/** @typedef columnAddress
 * @property {string} name - The name of a column listed in the fields array. See the {@link DataSourceTreeview#getFields|getFields()} method.
 * @property {number} index - The index of the column in the fields array. See the {@link DataSourceTreeview#getFields|getFields()} method.
 */


/**
 * @classdesc For proper sorting, include `DataSourceTreeviewSorter` in your data source pipeline, _ahead of_ (closer to the data than) this data source.
 *
 * For proper filtering, include `DataSourceTreeviewFilter` in your data source pipeline, _ahead of_ `DataSourceTreeviewSorter`, if included; or at any rate ahead of this data source.
 * @constructor
 * @param dataSource
 * @extends DataSourceIndexed
 */
var DataSourceTreeview = DataSourceIndexed.extend('DataSourceTreeview', {

    /** @summary Initialize a new instance.
     * @desc Set up {@link DataSourceTreeviewSorter} access to this object. Access is provided to the whole object although only instance variables `joined`, `idColumn`, and `parentIdColumn` are needed by the sorter. The two ID columns are passed to the {@link DataSourceDepthSorter} constructor. (If dataSource is not the sorter, this is not used but harmless.)
     *
     * Note that all ancestor classes' `initialize` methods are called (top-down) before this one. See {@link http://npmjs.org/extend-me} for more info.
     * @param dataSource
     * @memberOf DataSourceTreeview#
     */
    initialize: function(dataSource) {
        while (dataSource) {
            if (/treeview/i.test(dataSource.$$CLASS_NAME)) {
                dataSource.treeview = this;
            }
            dataSource = dataSource.dataSource;
        }
    },

    /** @summary Reference to the primary key column address object.
     * @desc The primary key column uniquely identifies a data row.
     * Used to relate a child row to a parent row.
     *
     * Redefined each time tree-view is turned *ON* by a call to {@link DataSourceTreeview#setRelation|setRelation()}.
     * @param {number|string} indexOrName
     * @returns {columnAddress} Getter returns column address object; setter however always returns its input.
     */
    set idColumn(indexOrName) {
        this._idColumn = this.getColumnInfo(indexOrName || 'ID');
    },
    get idColumn() {
        return this._idColumn;
    },

    /** @summary Reference to the foreign key column address object.
     * @desc The foreign key column defines grouping; it relates this tree node row to its parent tree node row. Top-level tree nodes have no parent. In that case the value in the column is `null`.
     *
     * Redefined each time tree-view is turned *ON* by a call to {@link DataSourceTreeview#setRelation|setRelation()}.
     * @param {number|string} indexOrName
     * @returns {columnAddress} Getter returns column address object; setter however always returns its input.
     */
    set parentIdColumn(indexOrName) {
        this._parentIdColumn = this.getColumnInfo(indexOrName || 'parentID');
    },
    get parentIdColumn() {
        return this._parentIdColumn;
    },

    /** @summary Reference to the drill-down column address object.
     * @desc The drill-down column is the column that is indented and decorated with drill-down controls (triangles). A column with the given index or name must exist.
     *
     * Redefined each time tree-view is turned *ON* by a call to {@link DataSourceTreeview#setRelation|setRelation()}.
     * @param {number|string} indexOrName
     * @returns {columnAddress} Getter returns column address object; setter however always returns its input.
     */
    set treeColumn(indexOrName) {
        this._treeColumn = this.getColumnInfo(indexOrName || 'name');
    },
    get treeColumn() {
        return this._treeColumn;
    },

    /**
     /** @summary Reference to the group name column address object.
     * @desc The group name column is the column whose content describes the group. A column with the given index or name must exist.
     *
     * The treeview sorter treats the group name column differently than other columns,
     * apply a "group sort" to it, which means only the group rows (rows with children)
     * are sorted and the leaves are left alone (stable sorted).
     *
     * Normally refers to the same column as {@link DataSourceTreeview#treeColumn|treeColumn}.
     *
     * Redefined each time tree-view is turned *ON* by a call to {@link DataSourceTreeview#setRelation|setRelation()}.
     * @param {number|string} indexOrName
     * @returns {columnAddress} Getter returns column address object; setter however always returns its input.
     */
    set groupColumn(indexOrName) {
        this._groupColumn = this.getColumnInfo(indexOrName || this._treeColumn.name);
    },
    get groupColumn() {
        return this._groupColumn;
    },

    /**
     * TEMPORARY. This function included here until next version of base is published.
     * The change was to use schema rather than getFields().
     * (The current version in base is not in use because it's only used from here.)
     *
     * Get new object with name and index given the name or the index.
     * @param {string|number} columnOrIndex - Column name or index.
     * @returns {{name: string, index: number}}
     */
    getColumnInfo: function(columnOrIndex) {
        var name, index, result;

        if (typeof columnOrIndex === 'number') {
            index = columnOrIndex;
            name = this.schema[index].name;
        } else {
            name = columnOrIndex;
            index = this.schema.findIndex(function(columnSchema) {
                return columnSchema.name === name;
            });
        }

        if (name && index >= 0) {
            result = {
                name: name,
                index: index
            };
        }

        return result;
    },

    /**
     * @summary Toggle the tree-view.
     * @desc Calculates or recalculates nesting depth of each row and marks it as "expandable" iff it has children.
     *
     * If resetting previously set data, the state of expansion of all rows that still have children is retained. (All expanded rows will still be expanded when tree-view is turned back *ON*.)
     *
     * All of the columns referenced by the `options` properties `idColumn`, `parentIdColumn`, `treeColumn`, and `groupColumn` must exist. These four columns have default references (names) as listed below. The references may be overridden in `options` by supplying alternate column names or indexes.
     *
     * @param {boolean|object} [options] - Falsy value (or omitted) turns tree-view **OFF**. Truthy value turns tree-view **ON** using following options:
     * @param {number|string} [options.idColumn='ID'] - Name or index of the primary key column.
     * @param {number|string} [options.parentIdColumn='parentID'] - Name or index of the foreign key column for grouping.
     * @param {number|string} [options.treeColumn='name'] - Name or index of the drill-down column to decorate with triangles.
     * @param {number|string} [options.groupColumn=this._treeColumn.name] - Name or index of the column that contains the group names. This is normally the same as the drill-down column. You only need to specify a different value when you want the drill down to this column, such as when the drill-down is in a column of its own. See {@link http://openfin.github.io/fin-hypergrid/tree-view-separate-drill-down.html} for an example.
     * @returns {boolean} Joined state.
     *
     * @memberOf DataSourceTreeview#
     */
    setRelation: function(options) {
        var r, parentID, depth, leafRow, row, ID;

        // successful join requires that options object be given and that all columns exist
        if (!options) {
            this.joined = false;
        } else {
            this.idColumn = options.idColumn;
            this.parentIdColumn = options.parentIdColumn;
            this.treeColumn = options.treeColumn;
            this.groupColumn = options.groupColumn;
            this.joined = !!(this.idColumn && this.parentIdColumn && this.treeColumn && this.groupColumn);
        }

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

                while ((parentID = row[parentIdColumnName]) != null) {
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

        // look for DataSourceTreeviewFilter

        return this.joined;
    },

    /**
     * @summary Rebuild the index.
     * @desc Rebuild the index to show only "revealed" rows. (Rows that are not inside a collapsed parent node row.)
     * @memberOf DataSourceTreeview#
     */
    apply: function() {
        if (!this.viewMakesSense()) {
            this.clearIndex();
        } else {
            this.buildIndex(this.joined && rowIsRevealed);
        }
    },

    /**
     * @summary Get the value for the specified cell.
     * @desc Intercepts tree column values and indents and decorates them.
     * @param x
     * @param y
     * @returns {*}
     * @memberOf DataSourceTreeview#
     */
    getValue: function(x, y) {
        var value = DataSourceIndexed.prototype.getValue.call(this, x, y);

        if (this.viewMakesSense() && x === this._treeColumn.index) {
            var row = this.getRow(y);

            if (!(value === '' && row.__EXPANDED === undefined)) {
                value = Array(row.__DEPTH + 1).join('   ') + this.drillDownCharMap[row.__EXPANDED ? 'OPEN' : 'CLOSE'] + value;
            }
        }

        return value;
    },

    viewMakesSense: function() {
        return this.joined;
    },
    /**
     * @memberOf DataSourceTreeview#
     * @param {number} columnIndex
     * @returns {*|boolean}
     */
    isDrillDown: function(columnIndex) {
        var result = this.viewMakesSense();
        if (result && columnIndex) {
            result = columnIndex === this.treeColumnIndex;
        }
        return result;
    },

    isDrillDownCol: function (event) {
        return event && event.dataCell.x === this._treeColumn.index;
    },

    /**
     * @summary Handle a click event in the drill-down column.
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
     * @memberOf DataSourceTreeview#
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
     * @memberOf DataSourceTreeview#
     */
    revealRow: function(ID) {
        if (!this.viewMakesSense()) {
            return this.dataSource.revealRow.apply(this.dataSource, arguments);
        }

        var row, parent, changed = false;
        while ((row = this.findRow(this._idColumn.name, ID))) {
            if (parent && row.__EXPANDED === false) {
                row.__EXPANDED = changed = true;
            }
            parent = true;
            ID = row[this._parentIdColumn.name];
        }
        return changed;
    }
});

function rowIsRevealed(r, row) {
    var parentID;

    // are any of the row's ancestors collapsed?
    while ((parentID = row[this._parentIdColumn.name]) != null) {
        // walk up through each parent...
        row = this.findRow(this._idColumn.name, parentID);
        if (row.__EXPANDED === false) { // an ancestor is collapsed
            return false; // exclude row from build
        }
    }

    // no ancestors were collapsed
    return true; // include row in build
}

Object.defineProperty(DataSourceTreeview.prototype, 'type', { value: 'treeviewer' }); // read-only property

module.exports = DataSourceTreeview;
