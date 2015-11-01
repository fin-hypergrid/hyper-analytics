var test = require('./util/test');

module.exports = function() {
    test.constructorModule('DataSourceFilter', function (DataSourceFilter) {
        var DATA;
        beforeEach(function () {
            DATA = [
                [4, 25, 66],
                [1, 22, 63],
                [7, 28, 69],
                [13, 54, 35],
                [10, 51, 32]
            ];
            object = new DataSourceFilter(DATA);
        });

        it('descends from DataSource', function () {
            object.should.be.instanceof(require('../src/js/DataSource'));
        });

        it('initializes `filters` to empty array', function () {
            object.filters.should.be.an.Array();
            object.filters.length.should.equal(0);
        });

        describe('HAS TWO SIMILAR METHODS', function () {
            [
                'addFilter',
                'setFilter'
            ].forEach(function (methodName) {
                test.method(methodName, 2, function () {
                    var index, filter;
                    beforeEach(function () {
                        index = [];
                        filter = {};
                        object[methodName](index, filter);
                    });

                    it('adds 1st first param (array `columnIndex`) to 2nd param (object `filter`) as property `columnIndex`', function () {
                        filter.columnIndex.should.equal(index);
                    });
                    it('adds 2nd param (`filter`) to `filters` array', function () {
                        object.filters.indexOf(filter).should.be.greaterThanOrEqual(0);
                    });
                });
            });
        });

        test.method('clearFilters', 0, function () {
            beforeEach(function () {
                object.clearFilters();
            });
            it('empties `filters`', function () {
                object.filters.length.should.equal(0);
            });
            it('undefines `index`', function () {
                (typeof object.index).should.equal('undefined');
            })
        });

        test.method('getRowCount', 0, function () {
            describe('there is indexed data so', function () {
                it('returns number of hits in the index', function () {
                    var INDEX = [3, 4];
                    object.index = INDEX;
                    object.getRowCount().should.equal(INDEX.length);
                });
            });
            describe('there is no indexed data but filtering is active so', function () {
                it('returns 0 (meaning no hits)', function () {
                    object.filters = [function () {}];
                    object.getRowCount().should.equal(0);
                });
            });
            describe('there is no indexed data and filtering is inactive so', function () {
                it('return all rows', function () {
                    object.getRowCount().should.equal(DATA.length);
                });
            })
        });
    });
};
