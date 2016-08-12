var test = require('./util/test');
var headerify = require('../js/util/headerify');
var should = require('should'); // extends `Object` (!) with `.should`; creates `should()`

headerify.transform = headerify.capitalize;

var INDEX_VECTOR = [ 0, 1, 2, 3, 4 ],
    INVERSE_VECTOR = [ 4, 3, 2, 1, 0];

module.exports = function() {
    test.constructorModule('DataSource', /*'unindexed',*/ function(DataSource) {
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

            describe('returns a value that', function() {
                it('is an object', function() {
                    object.should.be.an.Object();
                });

                test.property('data', function() {
                    it('is set to 1st parameter', function() {
                        object.data.should.equal(DATA);
                    });
                });

                test.property('fields', function() {
                    it('is set to 2nd parameter', function() {
                        object.fields.should.equal(fields);
                    });
                });
            });
        });
        describe('with 1 parameter', function() {
            var altFields = ['inaugurated', 'term-ended', 'lastName', 'firstName'];

            beforeEach(function() {
                object = new DataSource(DATA);
            });

            describe('returns an value that', function() {
                it('is an object', function() {
                    object.should.be.an.Object();
                });

                test.property('data', function() {
                    it('references the first parameter', function() {
                        object.data.should.equal(DATA);
                    });
                });

                test.property('fields', function() {
                    it('is a list of all keys in first element of first parameter (`data`) that do not begin with double-underscore ("__")', function() {
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

                test.method('getRowCount', 0, function() {
                    it('returns the correct number of rows in the data', function() {
                        object.getRowCount().should.equal(DATA.length);
                    });
                });

                test.method('getRow', 1, function() {
                    it('returns correct row of data', function() {
                        for (var i = DATA.length; i--;) {
                            object.getRow(i).should.equal(DATA[i]);
                        }
                    });
                });

                test.method('findRow', 3);

                test.method('getValue', 2, function() {
                    it('returns `null` for non-existent row', function() {
                        should(object.getValue(3, 9)).equal(null);
                    });
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

                test.method('setValue', 3, function() {
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
