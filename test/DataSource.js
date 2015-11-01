var test = require('./util/test');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`

var INDEX_VECTOR = [ 0, 1, 2, 3, 4 ],
    INVERSE_VECTOR = [ 4, 3, 2, 1, 0];

module.exports = function() {
    test.constructorModule('DataSource', function(DataSource) {
        var DATA, DATA_MAX;
        beforeEach(function() {
            DATA = [
                { firstName: 'George', lastName: 'Washington', __rating: 5, inaugurated: 1789, 'term-ended': 1797 },
                { firstName: 'John',   lastName: 'Adams',      __rating: 4, inaugurated: 1797, 'term-ended': 1801 },
                { firstName: 'Thomas', lastName: 'Jefferson',  __rating: 4, inaugurated: 1801, 'term-ended': 1809 },
                { firstName: 'James',  lastName: 'Madison',    __rating: 2, inaugurated: 1809, 'term-ended': 1817 },
                { firstName: 'James',  lastName: 'Monroe',     __rating: 3, inaugurated: 1817, 'term-ended': 1825 }
            ];
            DATA_MAX = DATA.length - 1;
        });
        describe('with 2 parameters', function() {
            var fields;
            beforeEach(function() {
                fields = ['lastName', 'firstName'];
                object = new DataSource(DATA, fields);
            });
            it('has a (private?) property `data` that references the first parameter', function() {
                object.data.should.equal(DATA);
            });
            it('has a (private?) property `fields` that references the second parameter', function() {
                object.fields.should.equal(fields);
            });
        });
        describe('with 1 parameter returns a value that', function() {
            var altFields = ['inaugurated', 'term-ended', 'lastName', 'firstName'];

            beforeEach(function() {
                object = new DataSource(DATA);
            });

            test.property('data', function() {
                it('references the first parameter', function() {
                    object.data.should.equal(DATA);
                });
            });

            test.property('fields', function() {
                it('is a list of all keys in first element of first parameter of constructor that do not begin with double-underscore ("__")', function() {
                    object.fields.length.should.equal(4);
                    // making no assumption here about order:
                    object.fields.indexOf('firstName').should.be.greaterThanOrEqual(0);
                    object.fields.indexOf('lastName').should.be.greaterThanOrEqual(0);
                    object.fields.indexOf('inaugurated').should.be.greaterThanOrEqual(0);
                    object.fields.indexOf('term-ended').should.be.greaterThanOrEqual(0);
                });
            });

            test.property('isNullObject', function() {
                it('is initially set to false', function() {
                    object.isNullObject.should.equal(false);
                });
            });

            describe('HAS UNFILTERED DATA FUNCTIONS', function() {
                test.method('getUnfilteredRowCount', 0, function() {
                    describe('without index vector', function() {
                        it('returns the correct number of rows in the data', function() {
                            object.getUnfilteredRowCount().should.equal(DATA.length);
                        });
                    });
                    describe('with index vector', function() {
                        it('returns correct row of data', function() {
                            object.index = [ 1, 2, 3 ];
                            for (var i = DATA.length; i--;) {
                                object.getUnfilteredRowCount().should.equal(DATA.length);
                            }
                        });
                    });
                });

                test.method('getUnfilteredRow', 1, function() {
                    describe('without index vector', function() {
                        it('returns correct row of data', function() {
                            for (var i = DATA.length; i--;) {
                                object.getUnfilteredRow(i).should.equal(DATA[i]);
                            }
                        });
                    });
                    describe('with reversed index vector', function() {
                        it('ignores index and returns correct row of data', function() {
                            object.index = INVERSE_VECTOR;
                            for (var i = DATA.length; i--;) {
                                object.getUnfilteredRow(i).should.equal(DATA[i]);
                            }
                        });
                    });
                });

                test.method('getUnfilteredValue', 2, function() {
                    it('returns `null` for non-existent row', function() {
                        should(object.getUnfilteredValue(3, 9)).equal(null);
                    });
                    describe('without index vector', function() {
                        it('returns correct data', function() {
                            object.setFields(altFields);
                            // spot check one field for each row:
                            object.getUnfilteredValue(3, 0).should.equal(DATA[0].firstName);
                            object.getUnfilteredValue(2, 1).should.equal(DATA[1].lastName);
                            object.getUnfilteredValue(0, 2).should.equal(DATA[2].inaugurated);
                            object.getUnfilteredValue(1, 3).should.equal(DATA[3]['term-ended']);
                            object.getUnfilteredValue(3, 4).should.equal(DATA[4].firstName);
                        });
                    });
                    describe('with reversed index vector', function() {
                        it('ignores index and returns correct data', function() {
                            object.index = INVERSE_VECTOR;
                            object.setFields(altFields);
                            // spot check one field for each row:
                            object.getUnfilteredValue(3, 0).should.equal(DATA[0].firstName);
                            object.getUnfilteredValue(2, 1).should.equal(DATA[1].lastName);
                            object.getUnfilteredValue(0, 2).should.equal(DATA[2].inaugurated);
                            object.getUnfilteredValue(1, 3).should.equal(DATA[3]['term-ended']);
                            object.getUnfilteredValue(3, 4).should.equal(DATA[4].firstName);
                        });
                    });
                });

                test.method('setUnfilteredValue', 3, function() {
                    describe('without index vector', function() {
                        it('sets correct cells', function() {
                            object.setFields(['lastName', 'firstName']);
                            object.setUnfilteredValue(0, 3, 'Carter');
                            object.setUnfilteredValue(1, 3, 'Jimmy');
                            should(DATA[3]).deepEqual({
                                firstName: 'Jimmy',
                                lastName: 'Carter',
                                __rating: 2,
                                inaugurated: 1809,
                                'term-ended': 1817
                            });
                        });
                    });
                    describe('with reversed index vector', function() {
                        it('ignores index and sets correct cells', function() {
                            object.index = INVERSE_VECTOR;
                            object.setFields(['lastName', 'firstName']);
                            object.setUnfilteredValue(0, 3, 'Carter');
                            object.setUnfilteredValue(1, 3, 'Jimmy');
                            should(DATA[3]).deepEqual({
                                firstName: 'Jimmy',
                                lastName: 'Carter',
                                __rating: 2,
                                inaugurated: 1809,
                                'term-ended': 1817
                            });
                        });
                    });
                });
            });

            describe('HAS FILTERED DATA FUNCTIONS', function() {
                test.method('getRowCount', 0, function() {
                    describe('without index vector', function() {
                        it('returns the correct number of rows in the data', function() {
                            object.getRowCount().should.equal(DATA.length);
                        });
                    });
                    describe('with index vector', function() {
                        it('returns correct row of data', function() {
                            object.index = [ 1, 2, 3 ];
                            for (var i = DATA.length; i--;) {
                                object.getRowCount(i).should.equal(3);
                            }
                        });
                    });
                });

                test.method('getRow', 1, function() {
                    describe('without index vector', function() {
                        it('returns correct row of data', function() {
                            for (var i = DATA.length; i--;) {
                                object.getRow(i).should.equal(DATA[i]);
                            }
                        });
                    });
                    describe('with default "identity" index vector', function() {
                        it('returns correct row of data', function() {
                            for (var i = DATA.length; i--;) {
                                object.getRow(i).should.equal(DATA[i]);
                            }
                        });
                    });
                    describe('with reversed index vector', function() {
                        it('returns correct row of data', function() {
                            object.index = INVERSE_VECTOR;
                            for (var i = DATA.length; i--;) {
                                object.getRow(i).should.equal(DATA[DATA_MAX - i]);
                            }
                        });
                    });
                });

                test.method('getValue', 2, function() {
                    it('returns `null` for non-existent row', function() {
                        should(object.getValue(3, 9)).equal(null);
                    });
                    describe('without index vector', function() {
                        it('returns correct data', function() {
                            object.setFields(altFields);
                            // spot check one field for each row:
                            object.getValue(3, 0).should.equal(DATA[0].firstName);
                            object.getValue(2, 1).should.equal(DATA[1].lastName);
                            object.getValue(0, 2).should.equal(DATA[2].inaugurated);
                            object.getValue(1, 3).should.equal(DATA[3]['term-ended']);
                            object.getValue(3, 4).should.equal(DATA[4].firstName);
                        });
                    });
                    describe('with reversed index vector', function() {
                        it('returns correct data', function() {
                            object.index = INVERSE_VECTOR;
                            object.setFields(altFields);
                            // spot check one field for each row:
                            object.getValue(3, 0).should.equal(DATA[DATA_MAX - 0].firstName);
                            object.getValue(2, 1).should.equal(DATA[DATA_MAX - 1].lastName);
                            object.getValue(0, 2).should.equal(DATA[DATA_MAX - 2].inaugurated);
                            object.getValue(1, 3).should.equal(DATA[DATA_MAX - 3]['term-ended']);
                            object.getValue(3, 4).should.equal(DATA[DATA_MAX - 4].firstName);
                        });
                    });
                });

                test.method('setValue', 3, function() {
                    describe('without index vector', function() {
                        it('sets correct cells', function() {
                            object.setFields(['lastName', 'firstName']);
                            object.setValue(0, 3, 'Carter');
                            object.setValue(1, 3, 'Jimmy');
                            should(DATA[3]).deepEqual({
                                firstName: 'Jimmy',
                                lastName: 'Carter',
                                __rating: 2,
                                inaugurated: 1809,
                                'term-ended': 1817
                            });
                        });
                    });
                    describe('with reversed index vector', function() {
                        it('sets correct cells', function() {
                            object.index = INVERSE_VECTOR;
                            object.setFields(['lastName', 'firstName']);
                            object.setValue(0, 3, 'Carter');
                            object.setValue(1, 3, 'Jimmy');
                            should(DATA[DATA_MAX - 3]).deepEqual({
                                firstName: 'Jimmy',
                                lastName: 'Carter',
                                __rating: 4,
                                inaugurated: 1797,
                                'term-ended': 1801
                            });
                        });
                    });
                });
            });

            test.method('getGrandTotals', 0, function() {
                it('returns `undefined`', function() {
                    should(object.getGrandTotals()).equal(undefined);
                });
            });

            test.method('getColumnCount', 0, function() {
                it('returns the number of items in `fields` list (unless changed since instantiation, this is the number of keys in first element of first parameter of constructor that do not begin with double-underscore)', function() {
                    object.getColumnCount().should.equal(4);
                });
            });

            test.method('getFields', 0, function() {
                it('returns `fields` property', function() {
                    object.getFields().should.equal(object.fields);
                });
            });

            test.method('setFields', 1, function() {
                it('returns `fields` property, which has been altered', function() {
                    object.setFields(altFields);
                    should(object.getFields()).deepEqual(altFields);
                });
            });

            test.method('getDefaultHeaders', 0, function() {
                it('returns `headers` property', function() {
                    object.getDefaultHeaders().should.equal(object.fields);
                });
            });

            test.method('getHeaders', 0, function() {
                describe('if headers previously set', function() {
                    it('returns previously set headers', function() {
                        var test = ['a'];
                        object.headers = test;
                        object.getHeaders();
                        object.headers.should.equal(test); // same reference
                        should(object.headers).deepEqual(['a']); // same contents
                    });
                });
                describe('if headers not previously set', function() {
                    it('returns (and sets headers to) default list, which is all keys in `fields`, separated into words with initial capitals where words are delineated by camelCasing, hyphenating, and underscoring', function() {
                        var headers = object.getHeaders();
                        headers.length.should.equal(4);
                        // making no assumption here about order:
                        headers.indexOf('First Name').should.be.greaterThanOrEqual(0);
                        headers.indexOf('Last Name').should.be.greaterThanOrEqual(0);
                        headers.indexOf('Inaugurated').should.be.greaterThanOrEqual(0);
                        headers.indexOf('Term Ended').should.be.greaterThanOrEqual(0);
                    });
                });
            });

            test.method('setHeaders', 1, function() {
                describe('with an array', function() {
                    it('sets headers to given array', function() {
                        object.setHeaders(altFields);
                        should(object.getHeaders()).deepEqual(altFields);
                    });
                });
                describe('with anything other than an array', function() {
                    it('throws an error', function() {
                        object.setHeaders.should.throw();
                    });
                });
            });

            test.method('clearIndex', 0, function() {
                it('undefines `index`', function () {
                    object.index = [2, 4];
                    (!object.index).should.be.false();
                    object.clearIndex();
                    (!object.index).should.be.true();
                });
            });

            test.method('buildIndex', 1, function() {
                describe('with no parameters', function() {
                    it('sets `index` to initial state', function () {
                        object.buildIndex();
                        should(object.index).deepEqual(INDEX_VECTOR);
                    });
                });
                describe('with 1st parameter (`predicate`),', function() {
                    describe('testing how predicate is called,', function() {
                        it('called with expected parameter values', function () {
                            var dump = [];
                            function oddRowsOnly(r, rowObject) {
                                dump[r] = rowObject;
                            }
                            object.buildIndex(oddRowsOnly);
                            should(dump).deepEqual(DATA);
                        });
                    });
                    describe('testing resultant index,', function() {
                        it('sets `index` correctly', function () {
                            function oddRowsOnly(r, rowObject) {
                                return r & 1;
                            }
                            object.buildIndex(oddRowsOnly);
                            should(object.index).deepEqual([1, 3]);
                        });
                    });
                });
            });

            test.method('setData', 1, function() {
                it('returns `headers` property', function() {
                    var altData = [
                        { a: 1, b: 2 },
                        { a: 3, b: 4 }
                    ];
                    object.setData(altData);
                    should(object.data).deepEqual(altData);
                });
            });
        });
    });
}
