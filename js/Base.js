'use strict';

var Base = require('fin-hypergrid-data-source-base');

// Following are for legacy methods

Base.prototype.getFields = function() {
    if (this.dataSource) {
        return this.dataSource.getFields();
    }
};

Base.prototype.getHeaders = function() {
    if (this.dataSource) {
        return this.dataSource.getHeaders();
    }
};

Base.prototype.getCalculators = function() {
    if (this.dataSource) {
        return this.dataSource.revealRow();
    }
};

Base.prototype.setFields = function(arr) {
    if (this.dataSource) {
        return this.dataSource.setFields.call(this.dataSource, arr);
    }
};

Base.prototype.setHeaders = function(arr) {
    if (this.dataSource) {
        return this.dataSource.setHeaders.call(this.dataSource, arr);
    }
};

module.exports = Base;
