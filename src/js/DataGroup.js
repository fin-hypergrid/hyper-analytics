'use strict';

var Map = require('./map');

module.exports = (function() {

    function DataGroup(key) {
        this.label = key;
        this.children = new Map();
        this.hasChildren = true;
        this.expanded = false;
    }

    DataGroup.prototype.prune = function() {
        this.children = this.children.values;
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].prune();
        }
    };

    return DataGroup;

})();
