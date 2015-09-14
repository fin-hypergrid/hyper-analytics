'use strict';

var Map = require('./map');

module.exports = (function() {

    function DataLeaf(key) {
        this.label = key;
        this.rowIndex = 0;
        this.hasChildren = false;
        this.depth = 0;
        this.height = 1;
    };

    DataLeaf.prototype.prune = function(depth) {
        this.depth = depth;
    };

    DataLeaf.prototype.computeHeight = function() {
        return 1;
    };

    return DataLeaf;

})();
