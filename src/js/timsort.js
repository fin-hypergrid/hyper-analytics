'use strict';

module.exports = (function() {

    var timsort = function(indexVector, array, comp) {

        var globalA = array;
        var MIN_MERGE = 32;
        var MIN_GALLOP = 7
        var runBase = [];
        var runLen = [];
        var stackSize = 0;
        var compare = comp || function(a, b) {
                if (a < b) {
                    return -1;
                }
                if (a > b) {
                    return 1;
                }
                return 0;
            };

        sort(array, 0, array.length, compare);

         function sort (a, lo, hi, compare) {

                if (typeof compare != "function") {
                    throw new Error("Compare is not a function.");
                    return;
                }

                stackSize = 0;
                runBase=[];
                runLen=[];

                rangeCheck(a.length, lo, hi);
                var nRemaining = hi - lo;
                if (nRemaining < 2) return; // Arrays of size 0 and 1 are always sorted


                if (nRemaining < MIN_MERGE) {
                    var initRunLen = countRunAndMakeAscending(a, lo, hi, compare);
                    binarySort(a, lo, hi, lo + initRunLen, compare);
                    return;
                }


                var ts = [];
                var minRun = minRunLength(nRemaining);
                do {
                    // Identify next run
                    var runLenVar = countRunAndMakeAscending(a, lo, hi, compare);

                    // If run is short, extend to min(minRun, nRemaining)
                    if (runLenVar < minRun) {
                        var force = nRemaining <= minRun ? nRemaining : minRun;
                        binarySort(a, lo, lo + force, lo + runLenVar, compare);
                        runLenVar = force;
                    }

                    // Push run onto pending-run stack, and maybe merge
                    pushRun(lo, runLenVar);
                    mergeCollapse();

                    // Advance to find next run
                    lo += runLenVar;
                    nRemaining -= runLenVar;
                } while (nRemaining != 0);

                // Merge all remaining runs to complete sort
                mergeForceCollapse();
            }

        function binarySort(a, lo, hi, start, compare) {
            if (start == lo) start++;
            for (; start < hi; start++) {
                var pivot = a[start];

                var left = lo;
                var right = start;
               while (left < right) {
                    var mid = (left + right) >>> 1;
                    if (compare(pivot, a[mid]) < 0)
                        right = mid;
                    else
                        left = mid + 1;
                }

                 var n = start - left;

                switch (n) {
                    case 2:
                        a[left + 2] = a[left + 1];
                    case 1:
                        a[left + 1] = a[left];
                        break;
                    default:
                        arraycopy(a, left, a, left + 1, n);
                }
                a[left] = pivot;
            }
        }

        function countRunAndMakeAscending(a, lo, hi, compare) {
            var runHi = lo + 1;


            if (compare(a[runHi++], a[lo]) < 0) { // Descending
                while (runHi < hi && compare(a[runHi], a[runHi - 1]) < 0) {
                    runHi++;
                }
                reverseRange(a, lo, runHi);
            } else { // Ascending
                while (runHi < hi && compare(a[runHi], a[runHi - 1]) >= 0) {
                    runHi++;
                }
            }

            return runHi - lo;
        }

        function reverseRange(a, lo, hi) {
            hi--;
            while (lo < hi) {
                var t = a[lo];
                a[lo++] = a[hi];
                a[hi--] = t;
            }
        }

        function minRunLength(n) {
            var r = 0;
            return n + 1;
        }

        function pushRun(runBaseArg, runLenArg) {
            runBase[stackSize] = runBaseArg;
            runLen[stackSize] = runLenArg;
            stackSize++;
        }

        function mergeCollapse() {
            while (stackSize > 1) {
                var n = stackSize - 2;
                if (n > 0 && runLen[n - 1] <= runLen[n] + runLen[n + 1]) {
                    if (runLen[n - 1] < runLen[n + 1]) n--;
                    mergeAt(n);
                } else if (runLen[n] <= runLen[n + 1]) {
                    mergeAt(n);
                } else {
                    break; // Invariant is established
                }
            }
        }

        function mergeForceCollapse() {
            while (stackSize > 1) {
                var n = stackSize - 2;
                if (n > 0 && runLen[n - 1] < runLen[n + 1]) n--;
                mergeAt(n);
            }
        }

        function mergeAt(i) {

            var base1 = runBase[i];
            var len1 = runLen[i];
            var base2 = runBase[i + 1];
            var len2 = runLen[i + 1];

            runLen[i] = len1 + len2;
            if (i == stackSize - 3) {
                runBase[i + 1] = runBase[i + 2];
                runLen[i + 1] = runLen[i + 2];
            }
            stackSize--;

            var k = gallopRight(globalA[base2], globalA, base1, len1, 0, compare);
            base1 += k;
            len1 -= k;
            if (len1 == 0) return;

            len2 = gallopLeft(globalA[base1 + len1 - 1], globalA, base2, len2, len2 - 1, compare);

            if (len2 == 0) return;

            if (len1 <= len2)
                mergeLo(base1, len1, base2, len2);
            else
                mergeHi(base1, len1, base2, len2);
        }

        function gallopLeft(key, a, base, len, hint, compare) {
            var lastOfs = 0;
            var ofs = 1;
            if (compare(key, a[base + hint]) > 0) {
                // Gallop right until a[base+hint+lastOfs] < key <= a[base+hint+ofs]
                var maxOfs = len - hint;
                while (ofs < maxOfs && compare(key, a[base + hint + ofs]) > 0) {
                    lastOfs = ofs;
                    ofs = (ofs << 1) + 1;
                    if (ofs <= 0) // int overflow
                        ofs = maxOfs;
                }
                if (ofs > maxOfs) ofs = maxOfs;

                // Make offsets relative to base
                lastOfs += hint;
                ofs += hint;
            } else { // key <= a[base + hint]
                // Gallop left until a[base+hint-ofs] < key <= a[base+hint-lastOfs]
                var maxOfs = hint + 1;
                while (ofs < maxOfs && compare(key, a[base + hint - ofs]) <= 0) {
                    lastOfs = ofs;
                    ofs = (ofs << 1) + 1;
                    if (ofs <= 0) // int overflow
                        ofs = maxOfs;
                }
                if (ofs > maxOfs) ofs = maxOfs;

                // Make offsets relative to base
                var tmp = lastOfs;
                lastOfs = hint - ofs;
                ofs = hint - tmp;
            }
            lastOfs++;
            while (lastOfs < ofs) {
                var m = lastOfs + ((ofs - lastOfs) >>> 1);

                if (compare(key, a[base + m]) > 0)
                    lastOfs = m + 1; // a[base + m] < key
                else
                    ofs = m; // key <= a[base + m]
            }
            return ofs;
        }

        function gallopRight(key, a, base, len, hint, compare) {

            var ofs = 1;
            var lastOfs = 0;
            if (compare(key, a[base + hint]) < 0) {
                // Gallop left until a[b+hint - ofs] <= key < a[b+hint - lastOfs]
                var maxOfs = hint + 1;
                while (ofs < maxOfs && compare(key, a[base + hint - ofs]) < 0) {
                    lastOfs = ofs;
                    ofs = (ofs << 1) + 1;
                    if (ofs <= 0) // int overflow
                        ofs = maxOfs;
                }
                if (ofs > maxOfs) ofs = maxOfs;

                // Make offsets relative to b
                var tmp = lastOfs;
                lastOfs = hint - ofs;
                ofs = hint - tmp;
            } else { // a[b + hint] <= key
                // Gallop right until a[b+hint + lastOfs] <= key < a[b+hint + ofs]
                var maxOfs = len - hint;
                while (ofs < maxOfs && compare(key, a[base + hint + ofs]) >= 0) {
                    lastOfs = ofs;
                    ofs = (ofs << 1) + 1;
                    if (ofs <= 0) // int overflow
                        ofs = maxOfs;
                }
                if (ofs > maxOfs) ofs = maxOfs;

                // Make offsets relative to b
                lastOfs += hint;
                ofs += hint;
            }

            /*
             * Now a[b + lastOfs] <= key < a[b + ofs], so key belongs somewhere to the right of lastOfs but no farther right than ofs.
             * Do a binary search, with invariant a[b + lastOfs - 1] <= key < a[b + ofs].
             */
            lastOfs++;
            while (lastOfs < ofs) {
                var m = lastOfs + ((ofs - lastOfs) >>> 1);

                if (compare(key, a[base + m]) < 0)
                    ofs = m; // key < a[b + m]
                else
                    lastOfs = m + 1; // a[b + m] <= key
            }
            return ofs;
        }

        function mergeLo(base1, len1, base2, len2) {

            // Copy first run into temp array
            var a = globalA; // For performance
            var tmp = a.slice(base1, base1 + len1);

            var cursor1 = 0; // Indexes into tmp array
            var cursor2 = base2; // Indexes int a
            var dest = base1; // Indexes int a

            // Move first element of second run and deal with degenerate cases
            a[dest++] = a[cursor2++];
            if (--len2 == 0) {
                arraycopy(tmp, cursor1, a, dest, len1);
                return;
            }
            if (len1 == 1) {
                arraycopy(a, cursor2, a, dest, len2);
                a[dest + len2] = tmp[cursor1]; // Last elt of run 1 to end of merge
                return;
            }

            var c = compare; // Use local variable for performance

            var minGallop = MIN_GALLOP; // "    " "     " "
            outer: while (true) {
                var count1 = 0; // Number of times in a row that first run won
                var count2 = 0; // Number of times in a row that second run won

                /*
                 * Do the straightforward thing until (if ever) one run starts winning consistently.
                 */
                do {
                    if (compare(a[cursor2], tmp[cursor1]) < 0) {
                        a[dest++] = a[cursor2++];
                        count2++;
                        count1 = 0;
                        if (--len2 == 0) break outer;
                    } else {
                        a[dest++] = tmp[cursor1++];
                        count1++;
                        count2 = 0;
                        if (--len1 == 1) break outer;
                    }
                } while ((count1 | count2) < minGallop);

                /*
                 * One run is winning so consistently that galloping may be a huge win. So try that, and continue galloping until (if
                 * ever) neither run appears to be winning consistently anymore.
                 */
                do {
                    count1 = gallopRight(a[cursor2], tmp, cursor1, len1, 0, c);
                    if (count1 != 0) {
                        arraycopy(tmp, cursor1, a, dest, count1);
                        dest += count1;
                        cursor1 += count1;
                        len1 -= count1;
                        if (len1 <= 1) // len1 == 1 || len1 == 0
                            break outer;
                    }
                    a[dest++] = a[cursor2++];
                    if (--len2 == 0) break outer;

                    count2 = gallopLeft(tmp[cursor1], a, cursor2, len2, 0, c);
                    if (count2 != 0) {
                        arraycopy(a, cursor2, a, dest, count2);
                        dest += count2;
                        cursor2 += count2;
                        len2 -= count2;
                        if (len2 == 0) break outer;
                    }
                    a[dest++] = tmp[cursor1++];
                    if (--len1 == 1) break outer;
                    minGallop--;
                } while (count1 >= MIN_GALLOP | count2 >= MIN_GALLOP);
                if (minGallop < 0) minGallop = 0;
                minGallop += 2; // Penalize for leaving gallop mode
            } // End of "outer" loop
            globalA.minGallop = minGallop < 1 ? 1 : minGallop; // Write back to field

            if (len1 == 1) {
                arraycopy(a, cursor2, a, dest, len2);
                a[dest + len2] = tmp[cursor1]; // Last elt of run 1 to end of merge
            } else if (len1 == 0) {
                throw new Error("IllegalArgumentException. Comparison method violates its general contract!");
            } else {
                arraycopy(tmp, cursor1, a, dest, len1);
            }
        }

        function mergeHi(base1, len1, base2, len2) {

            // Copy second run into temp array
            var a = globalA; // For performance
            var tmp = a.slice(base2, base2 + len2);

            var cursor1 = base1 + len1 - 1; // Indexes into a
            var cursor2 = len2 - 1; // Indexes into tmp array
            var dest = base2 + len2 - 1; // Indexes into a

            // Move last element of first run and deal with degenerate cases
            a[dest--] = a[cursor1--];
            if (--len1 == 0) {
                arraycopy(tmp, 0, a, dest - (len2 - 1), len2);
                return;
            }
            if (len2 == 1) {
                dest -= len1;
                cursor1 -= len1;
                arraycopy(a, cursor1 + 1, a, dest + 1, len1);
                a[dest] = tmp[cursor2];
                return;
            }

            var c = compare; // Use local variable for performance

            var minGallop = MIN_GALLOP; // "    " "     " "
            outer: while (true) {
                var count1 = 0; // Number of times in a row that first run won
                var count2 = 0; // Number of times in a row that second run won

                /*
                 * Do the straightforward thing until (if ever) one run appears to win consistently.
                 */
                do {
                    if (compare(tmp[cursor2], a[cursor1]) < 0) {
                        a[dest--] = a[cursor1--];
                        count1++;
                        count2 = 0;
                        if (--len1 == 0) break outer;
                    } else {
                        a[dest--] = tmp[cursor2--];
                        count2++;
                        count1 = 0;
                        if (--len2 == 1) break outer;
                    }
                } while ((count1 | count2) < minGallop);

                /*
                 * One run is winning so consistently that galloping may be a huge win. So try that, and continue galloping until (if
                 * ever) neither run appears to be winning consistently anymore.
                 */
                do {
                    count1 = len1 - gallopRight(tmp[cursor2], a, base1, len1, len1 - 1, c);
                    if (count1 != 0) {
                        dest -= count1;
                        cursor1 -= count1;
                        len1 -= count1;
                        arraycopy(a, cursor1 + 1, a, dest + 1, count1);
                        if (len1 == 0) break outer;
                    }
                    a[dest--] = tmp[cursor2--];
                    if (--len2 == 1) break outer;

                    count2 = len2 - gallopLeft(a[cursor1], tmp, 0, len2, len2 - 1, c);
                    if (count2 != 0) {
                        dest -= count2;
                        cursor2 -= count2;
                        len2 -= count2;
                        arraycopy(tmp, cursor2 + 1, a, dest + 1, count2);
                        if (len2 <= 1) // len2 == 1 || len2 == 0
                            break outer;
                    }
                    a[dest--] = a[cursor1--];
                    if (--len1 == 0) break outer;
                    minGallop--;
                } while (count1 >= MIN_GALLOP | count2 >= MIN_GALLOP);
                if (minGallop < 0) minGallop = 0;
                minGallop += 2; // Penalize for leaving gallop mode
            } // End of "outer" loop
            globalA.minGallop = minGallop < 1 ? 1 : minGallop; // Write back to field

            if (len2 == 1) {
                dest -= len1;
                cursor1 -= len1;
                arraycopy(a, cursor1 + 1, a, dest + 1, len1);
                a[dest] = tmp[cursor2]; // Move first elt of run2 to front of merge
            } else if (len2 == 0) {
                throw new Error("IllegalArgumentException. Comparison method violates its general contract!");
            } else {
                arraycopy(tmp, 0, a, dest - (len2 - 1), len2);
            }
        }

        function rangeCheck(arrayLen, fromIndex, toIndex) {
            if (fromIndex > toIndex) throw new Error("IllegalArgument fromIndex(" + fromIndex + ") > toIndex(" + toIndex + ")");
            if (fromIndex < 0) throw new Error("ArrayIndexOutOfBounds " + fromIndex);
            if (toIndex > arrayLen) throw new Error("ArrayIndexOutOfBounds " + toIndex);
        }
    }

    // java System.arraycopy(Object src, int srcPos, Object dest, int destPos, int length)
        function arraycopy(s, spos, d, dpos, len) {
            var a = s.slice(spos, spos + len);
            while (len--) {
                d[dpos + len] = a[len];
            }
        }

    return timsort;

})();
