'use strict';

module.exports = (function() {

    var quicksort = function(indexVector, array, compare) {

        var less = compare || function(a, b) {
                if (a < b) {
                    return -1;
                }
                if (a > b) {
                    return 1;
                }
                return 0;
            };


        function swap(indexVector, items, firstIndex, secondIndex){
            var temp = indexVector[firstIndex];
            indexVector[firstIndex] = indexVector[secondIndex];
            indexVector[secondIndex] = temp;
        }

        function testLess(indexVector, a, b){

            var value = less(a, b);
            // if(value === 0){

            //     return a.__sortPosition - b.__sortPosition;
            // }

            return value;
        }

        function partition(indexVector, items, left, right) {

            var pivot   = items(indexVector[Math.floor((right + left) / 2)]),
                i       = left,
                j       = right;


            while (i <= j) {

                while (testLess(indexVector, items(indexVector[i]), pivot) < 0) {
                    i++;
                }

                while (testLess(indexVector, pivot, items(indexVector[j])) < 0) {
                    j--;
                }

                if (i <= j) {
                    swap(items, i, j);
                    i++;
                    j--;
                }
            }

            return i;
        }

        function sort(indexVector, items, left, right) {

            var index;

            if (indexVector.length > 1) {

                left = typeof left != "number" ? 0 : left;
                right = typeof right != "number" ? indexVector.length - 1 : right;

                index = partition(indexVector, items, left, right);

                if (left < index - 1) {
                    sort(indexVector, items, left, index - 1);
                }

                if (index<  right) {
                    sort(indexVector, items, index, right);
                }
            }

            return items;
        }

        //addPositions(indexVector, array);
        return sort(indexVector, array);
    };

    return quicksort;
})();
