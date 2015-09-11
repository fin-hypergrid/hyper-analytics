'use strict';

var stableSort = require('./stableSort.js');
var Map = require('./map.js');

module.exports = (function() {

    return {
        stableSort: stableSort,
        Map: Map
    };

})();
