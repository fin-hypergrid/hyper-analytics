'use strict';

var Map = require('./map');

module.exports = (function() {

    function DataLeaf(key) {
        this.label = key;
        this.hasChildren = false;
    }

    DataLeaf.prototype.prune = function() {};

    return DataLeaf;

})();
