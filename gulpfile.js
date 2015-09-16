'use strict';

var gulp      = require('gulp'),
    eslint    = require('gulp-eslint'),
    gitignore = require('gulp-exclude-gitignore'),
    browserify = require('gulp-browserify'),
    browserSync = require('browser-sync').create(),
    beautify = require('gulp-beautify'),
    gutil = require('gulp-util'),
    sourcemaps = require('gulp-sourcemaps'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    uglify = require('gulp-uglify');

var src = './src/';
var jsDir = src + 'js/';
var jsFiles = '**/*.js';

var js = {
    dir   : jsDir,
    files : jsFiles,
    path  : jsDir + jsFiles
};

gulp.task('lint', function() {
    if (isBuilding) {
        return;
    }
    return gulp.src(js.path)
        .pipe(gitignore())
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('browserSyncLaunchServer', function() {
    browserSync.init({
        server: {
         // Serve up our build folder
         baseDir: ['./build']
        },
        port: 5000
    });
});

var isBuilding = false;
// Basic usage

gulp.task('build', ['lint'], function() {
    // Single entry point to browserify
    if (isBuilding) {
        return;
    } else {
        isBuilding = true;
        setTimeout(function() {
            isBuilding = false;
        }, 1500);
    }

    gulp.src(js.path)
    .pipe(beautify({
        spaceAfterAnonFunction: false
    }))
    .pipe(gulp.dest(js.dir));

    return gulp.src('src/js/main.js')
        .pipe(browserify({
          insertGlobals : true,
          debug : true
        }))
//        .pipe(uglify())
        .pipe(gulp.dest('./build'));



  // // set up the browserify instance on a task basis
  // return gulp.src('src/js/main.js')
  //       .pipe(browserify({
  //         insertGlobals : true,
  //         debug : true
  //       }))
  //       .pipe(sourcemaps.init({loadMaps: true}))
  //       // Add transformation tasks to the pipeline here.
  //       .pipe(uglify())
  //       .on('error', gutil.log)
  //   .pipe(sourcemaps.write('./'))
  //   .pipe(gulp.dest('./build'));




});

gulp.task('reload', function() {
    browserSync.reload();
});

gulp.task('watch-dev', function() {
    gulp.watch(js.path, ['build']);
});

gulp.task('watch-build', function() {
    gulp.watch('./build/**/*.js', ['reload']);
});

gulp.task('default', ['browserSyncLaunchServer','watch-dev','watch-build']);


