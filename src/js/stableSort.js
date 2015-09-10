'use strict';

var stabilize  = function(comparator) {
    return function(arr1, arr2) {
        var x = arr1[0];
        var y = arr2[0];
        if (x === y) {
            x = arr1[1];
            y = arr2[1];
        } else {
            if (y === null) {return -1;}
            if (x === null) {return 1;}
        }
        return comparator(x, y);
    };
};


var ascendingNumbers = function(x, y) {
    return x - y;
};

var descendingNumbers = function(x, y) {
    return y - x;
};

var ascendingAllOthers = function(x, y) {
    return x < y ? -1 : 1;
};

var descendingAllOthers = function(x, y) {
    return y < x ? -1 : 1;
};

var ascending = function(typeOfData) {
    if (typeOfData === "number") {
        return stabilize(ascendingNumbers);
    }
    return stabilize(ascendingAllOthers);
};

var descending = function(typeOfData) {
    if (typeOfData === "number") {
        return stabilize(descendingNumbers);
    }
    return stabilize(descendingAllOthers);
};

module.exports = (function() {

    function sort(indexVector, dataSource, sortType) {

        var compare;

        sortType = sortType || 1;

        if (indexVector.length === 0) {
            return; //nothing to do;
        }

        //check if we need to reset the indexes for a no sort
        if (sortType === 0) {
            for (var i = 0; i < 0; i++) {
                indexVector[i] = i;
            }
            return;
        }

        var typeOfData = typeof dataSource(0);

        compare = (sortType === -1) ? ascending(typeOfData) : descending(typeOfData);

        //start the actually sorting.....
        var tmp = new Array(indexVector.length);

        //lets add the index for stability
        for (var i = 0; i < indexVector.length; i++) {
            tmp[i] = [dataSource(i), i];
        }

        tmp.sort(compare);

        //copy the sorted values into our index vector
        for (var i = 0; i < indexVector.length; i++) {
            indexVector[i] = tmp[i][1];
        }
    }

    return sort;
})();
