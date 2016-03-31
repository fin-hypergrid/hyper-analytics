'use strict';

var gulp        = require('gulp'),
    $$          = require('gulp-load-plugins')(),
    runSequence = require('run-sequence'),
    browserSync = require('browser-sync').create(),
    exec        = require('child_process').exec,
    path        = require('path');

var name     = 'hyper-analytics',
    global   = 'hyperAnalytics',
    srcDir   = './src/',
    testDir  = './test/',
    buildDir = './build/';

//  //  //  //  //  //  //  //  //  //  //  //

gulp.task('lint', lint);
gulp.task('test', test);
gulp.task('doc', doc);
gulp.task('beautify', beautify);
gulp.task('browserify', function(callback) {
    browserify();
    browserifyMin();
    callback();
});

gulp.task('build', function(callback) {
    clearBashScreen();
    runSequence(
        'lint',
        'test',
        //'doc',
        //'beautify',
        'browserify',
        callback
    );
});

gulp.task('watch', function () {
    gulp.watch([srcDir + '**', testDir + '**'], ['build'])
});

gulp.task('default', ['build', 'watch']);

//  //  //  //  //  //  //  //  //  //  //  //

function lint() {
    return gulp.src(srcDir + '**/*.js')
        .pipe($$.excludeGitignore())
        .pipe($$.eslint())
        .pipe($$.eslint.format())
        .pipe($$.eslint.failAfterError());
}

function test(cb) {
    return gulp.src(testDir + 'index.js')
        .pipe($$.mocha({reporter: 'spec'}));
}

function beautify() {
    return gulp.src(srcDir + '**/*.js')
        .pipe($$.beautify()) //apparent bug: presence of a .jsbeautifyrc file seems to force all options to their defaults (except space_after_anon_function which is forced to true) so I deleted the file. Any needed options can be included here.
        .pipe(gulp.dest(srcDir));
}

function browserify() {
    return gulp.src(srcDir + 'index.js')
        .pipe($$.replace(
            'module.exports =',
            'window.' + global + ' ='
        ))
        .pipe($$.browserify({  debug: true }))
        .on('error', $$.util.log)
        .pipe($$.rename(name + '.js'))
        .pipe(gulp.dest(buildDir));
}

function browserifyMin() {
    return gulp.src(srcDir + 'index.js')
        .pipe($$.replace(
            'module.exports =',
            'window.' + global + ' ='
        ))
        .pipe($$.browserify())
        .pipe($$.uglify())
        .on('error', $$.util.log)
        .pipe($$.rename(name + '.min.js'))
        .pipe(gulp.dest(buildDir));
}

function doc(cb) {
    exec(path.resolve('jsdoc.sh'), function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    });
}

function clearBashScreen() {
    var ESC = '\x1B';
    console.log(ESC + 'c'); // (VT-100 escape sequence)
}
