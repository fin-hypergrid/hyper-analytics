'use strict';

module.exports = (function() {

    var flashSort = function(indexVector, a) {
        var n = indexVector.length;

        var i = 0,
            j = 0,
            k = 0,
            t;
        var m = ~~ (n * 0.125); /*jshint ignore:line */
        var anmin = a(indexVector[0]);
        var nmax = 0;
        var nmove = 0;

        var l = new Array(m);
        for (i = 0; i < m; i++) {
            l[i] = 0;
        }

        for (i = 1; i < n; ++i) {
            var ai = a(indexVector[i]);
            if (ai < anmin) {
                anmin = ai;
            }
            if (ai > a(indexVector[nmax])) {
                nmax = i;
            }
        }

        var anmax = a(indexVector[nmax]);
        if (anmin === anmax) {
            return a;
        }
        var c1 = (m - 1) / (anmax - anmin);

        for (i = 0; i < n; ++i) {
            ++l[~~(c1 * (a(indexVector[i]) - anmin))]; /*jshint ignore:line */
        }

        for (k = 1; k < m; ++k) {
            l[k] += l[k - 1];
        }

        var hold = anmax;
        var hi = indexVector[nmax];
        indexVector[nmax] = indexVector[0];
        indexVector[0] = hi;

        var flash, fi;
        j = 0;
        k = m - 1;
        i = n - 1;

        while (nmove < i) {
            while (j > (l[k] - 1)) {
                k = ~~ (c1 * (a(indexVector[++j]) - anmin)); /*jshint ignore:line */
            }
            // line below added 07/03/2013, ES
            if (k < 0) {
                break;
            }

            fi = indexVector[j];
            flash = a(fi);
            while (j !== l[k]) {
                k = ~~ (c1 * (flash - anmin)); /*jshint ignore:line */
                t = --l[k];

                hold = a(indexVector[t]);
                hi = indexVector[t];
                indexVector[t] = fi;
                flash = hold;
                fi = hi;
                ++nmove;
            }
        }

        for (j = 1; j < n; ++j) {
            hold = a(indexVector[j]);
            hi = indexVector[j];
            i = j - 1;
            while (i >= 0 && a(indexVector[i]) > hold) {
                indexVector[i + 1] = indexVector[i--];
            }
            indexVector[i + 1] = hi;
        }

        return a;
    };


    return flashSort;

})();
