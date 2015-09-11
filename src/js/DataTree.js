'use strict';

var Map = require('./map');

module.exports = (function() {

    function DataTree() {
        this.label = 'root';
        this.children = new Map();
        this.hasChildren = true;
    }

    DataTree.prototype.prune = function() {
        this.children = this.children.values;
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].prune();
        }
    };

    return DataTree;

})();
