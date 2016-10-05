'use strict';

var Base = require('fin-hypergrid-data-source-base');

// Following is temporary until new DataBaseOrigin
Base.prototype.getFields = function() {
    if (this.dataSource) {
        return this.dataSource.getFields.apply(this.dataSource, arguments);
    }
};

Base.prototype.getHeaders = function() {
    if (this.dataSource) {
        return this.dataSource.getHeaders.apply(this.dataSource, arguments);
    }
};

Base.prototype.getCalculators = function() {
    if (this.dataSource) {
        return this.dataSource.revealRow.apply(this.dataSource, arguments);
    }
};

Base.prototype.setFields = function(arr) {
    if (this.dataSource) {
        return this.dataSource.setFields.apply(this.dataSource, arguments);
    }
};

Base.prototype.setHeaders = function(arr) {
    if (this.dataSource) {
        return this.dataSource.setHeaders.apply(this.dataSource, arguments);
    }
};

module.exports = Base;
