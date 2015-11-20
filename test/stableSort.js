var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`

module.exports = function() {
    test.module('stableSort', function() {
        var stableSort = require('../src/js/util/stableSort').sort;
        it('is a function', function() {
            stableSort.should.be.a.Function();
        });
        describe('when called', function() {
            var indexData, INDEX_VECTOR, originalIndexVector,
                DATA,
                ASC = [6, 3, 0, 4, 5, 7, 8, 1, 2],
                DESC = [2, 1, 8, 0, 4, 5, 7, 3, 6];

            function object(i) { return DATA[i][0]; }

            beforeEach(function() {
                INDEX_VECTOR = [];
                indexData = [];
                for (var idx = 9; idx--;) {
                    INDEX_VECTOR[idx] = indexData[idx] = Math.random() * 100 | 0;
                }
                originalIndexVector = INDEX_VECTOR;
            });

            it('takes 3 parameters', function() {
                stableSort.length.should.equal(3);
            });
            it('when sortType===0, does nothing', function() {
                stableSort(INDEX_VECTOR, object, 0);
                INDEX_VECTOR.should.equal(originalIndexVector); // still same object
                should(INDEX_VECTOR).deepEqual(indexData); // still same data
            });
            it('when INDEX_VECTOR is empty, does nothing', function() {
                INDEX_VECTOR.length = 0;
                stableSort(INDEX_VECTOR, object, 1);
                INDEX_VECTOR.should.equal(originalIndexVector); // still same object
                INDEX_VECTOR.length.should.equal(0); // still same data
            });
            describe('with numeric data,', function() {
                describe('(trial #1)', function() {
                    beforeEach(function() {
                        DATA = [
                            [3, 4], // 0
                            [7, 5], // 1
                            [9, 5], // 2
                            [2, 5], // 3
                            [3, 5], // 4
                            [3, 3], // 5
                            [1, 5], // 6
                            [3, 7], // 7
                            [4, 5]  // 8
                        ];
                    });
                    it('when sortType===1, sorts ascending with stable group data', function() {
                        stableSort(INDEX_VECTOR, object, 1);
                        INDEX_VECTOR.should.equal(originalIndexVector); // still same object
                        should(INDEX_VECTOR).deepEqual(ASC);
                    });
                    it('when sortType===-1, sorts descending with stable group data', function() {
                        stableSort(INDEX_VECTOR, object, -1);
                        INDEX_VECTOR.should.equal(originalIndexVector); // still same object
                        should(INDEX_VECTOR).deepEqual(DESC);
                    });
                });
                describe('(trial #2)', function() {
                    beforeEach(function() {
                        DATA = [
                            [3, 8], // 0
                            [7, 5], // 1
                            [9, 5], // 2
                            [2, 5], // 3
                            [3, 9], // 4
                            [3, 6], // 5
                            [1, 5], // 6
                            [3, 3], // 7
                            [4, 5]  // 8
                        ];
                    });
                    it('when sortType===1, sorts ascending with stable group data', function() {
                        stableSort(INDEX_VECTOR, object, 1);
                        INDEX_VECTOR.should.equal(originalIndexVector); // still same object
                        should(INDEX_VECTOR).deepEqual(ASC);
                    });
                    it('when sortType===-1, sorts descending with stable group data', function() {
                        stableSort(INDEX_VECTOR, object, -1);
                        INDEX_VECTOR.should.equal(originalIndexVector); // still same object
                        should(INDEX_VECTOR).deepEqual(DESC);
                    });
                });
            });
            describe('with non-numeric data,', function() {
                describe('(trial #1)', function() {
                    beforeEach(function() {
                        DATA = [
                            ['cherry',   'zinger'],    // 0
                            ['fennel',   'anise'],     // 1
                            ['garbanzo', 'beans'],     // 2
                            ['banana',   'milkshake'], // 3
                            ['cherry',   'preserves'], // 4
                            ['cherry',   'poptart'],   // 5
                            ['apple',    'pie'],       // 6
                            ['cherry',   'pie'],       // 7
                            ['endive',   'pizza']      // 8
                        ];
                    });
                    it('when sortType===1, sorts ascending with stable group data', function() {
                        stableSort(INDEX_VECTOR, object, 1);
                        INDEX_VECTOR.should.equal(originalIndexVector); // still same object
                        should(INDEX_VECTOR).deepEqual(ASC);
                    });
                    it('when sortType===-1, sorts descending with stable group data', function() {
                        stableSort(INDEX_VECTOR, object, -1);
                        INDEX_VECTOR.should.equal(originalIndexVector); // still same object
                        should(INDEX_VECTOR).deepEqual(DESC);
                    });
                });
                describe('(trial #2)', function() {
                    beforeEach(function() {
                        DATA = [
                            ['cherry',   'PIE'],       // 0
                            ['fennel',   'anise'],     // 1
                            ['garbanzo', 'beans'],     // 2
                            ['banana',   'milkshake'], // 3
                            ['cherry',   'ZINGER'],    // 4
                            ['cherry',   'JAM'],       // 5
                            ['apple',    'pie'],       // 6
                            ['cherry',   'TOAST'],     // 7
                            ['endive',   'pizza']      // 8
                        ];
                    });
                    it('when sortType===1, sorts ascending with stable group data', function() {
                        stableSort(INDEX_VECTOR, object, 1);
                        INDEX_VECTOR.should.equal(originalIndexVector); // still same object
                        should(INDEX_VECTOR).deepEqual(ASC);
                    });
                    it('when sortType===-1, sorts descending with stable group data', function() {
                        stableSort(INDEX_VECTOR, object, -1);
                        INDEX_VECTOR.should.equal(originalIndexVector); // still same object
                        should(INDEX_VECTOR).deepEqual(DESC);
                    });
                });
            });
        });
    });
};
