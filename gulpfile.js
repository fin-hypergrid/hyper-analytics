'use strict';

var gulp      = require('gulp');
var eslint    = require('gulp-eslint');
var gitignore = require('gulp-exclude-gitignore');
var mocha     = require('gulp-mocha');
var plumber   = require('gulp-plumber');
var exec      = require('child_process').exec;
var path      = require('path');
var browserify = require('gulp-browserify');
var browserSync = require('browser-sync');

var src = './src/';
var jsDir = src + 'js/';
var jsFiles = '**/*.js';

var js = {
    dir   : jsDir,
    files : jsFiles,
    path  : jsDir + jsFiles
};

function lint() {
    return gulp.src(js.path)
        .pipe(gitignore())
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
}

function test(cb) {
    var mochaErr;

    gulp.src('test/index.js')
        .pipe(plumber())
        .pipe(mocha({reporter: 'spec'}))
        .on('error', function(err) {
            mochaErr = err;
        })
        .on('end', function() {
            cb(mochaErr);
        });
}

function doc(cb) {
    exec(path.resolve('jsdoc.sh'), function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    });
}

function browserifydef() {
    // Single entry point to browserify
    gulp.src('src/js/main.js')
        .pipe(browserify({
          insertGlobals : true,
          debug : true
        }))
        .pipe(gulp.dest('./build'))
}

gulp.task('browserSync', function() {
 browserSync.init({
   server: {
     // Serve up our build folder
     baseDir: ['./build']
   },
   port: 5000
 });
});
// Basic usage
gulp.task('browserify', browserifydef);

gulp.task('lint', lint);
gulp.task('test', test);
gulp.task('doc', doc);

//gulp.task('depTest', ['lint'], test);
gulp.task('depTest', test);
gulp.task('depDoc', ['depTest'], doc);
gulp.task('reload', browserSync.reload);

gulp.task('watch', function() {
    gulp.watch(js.path, ['depDoc', 'browserify', 'reload']);
});

gulp.task('default', ['depDoc', 'browserSync', 'watch']);

