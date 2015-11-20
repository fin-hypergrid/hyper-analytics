'use strict';

var gulp        = require('gulp'),
    $$          = require('gulp-load-plugins')(),
    runSequence = require('run-sequence'),
    browserSync = require('browser-sync').create(),
    exec        = require('child_process').exec,
    path        = require('path');

var name     = 'hyper-analytics',
    srcDir   = './src/',
    testDir  = './test/',
    jsDir    = srcDir + 'js/',
    jsFiles  = '**/*.js',
    buildDir = './build/';

//var isBuilding = false;

var js = {
    dir   : jsDir,
    files : jsDir + jsFiles
};

//  //  //  //  //  //  //  //  //  //  //  //

gulp.task('lint', lint);
gulp.task('test', test);
gulp.task('doc', doc);
gulp.task('beautify', beautify);
gulp.task('browserify', browserify);
gulp.task('browserifyMin', browserifyMin);
gulp.task('browserSyncLaunchServer', browserSyncLaunchServer);

gulp.task('build', function(callback) {
    clearBashScreen();
    runSequence(
        'lint',
        'test',
        'doc',
        //'beautify',
        'browserify',
        'browserifyMin',
        callback
    );
});

gulp.task('watch', function () {
    gulp.watch([srcDir + '**', testDir + '**'], ['build'])
        .on('change', function(event) {
            browserSync.reload();
        });
});

gulp.task('default', ['build', 'watch'], browserSyncLaunchServer);

//  //  //  //  //  //  //  //  //  //  //  //

function lint() {
    return gulp.src(js.files)
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
    return gulp.src(js.files)
        .pipe($$.beautify()) //apparent bug: presence of a .jsbeautifyrc file seems to force all options to their defaults (except space_after_anon_function which is forced to true) so I deleted the file. Any needed options can be included here.
        .pipe(gulp.dest(js.dir));
}

function browserify() {
    return gulp.src(buildDir + name + '.browserify.js')
        .pipe($$.browserify({
            //insertGlobals : true,
            debug : true
        }))
        //.pipe($$.sourcemaps.init({loadMaps: true}))
        // Add transformation tasks to the pipeline here:
        //.on('error', $$.gutil.log)
        //.pipe($$.sourcemaps.write('./'))
        .on('error', $$.util.log)
        .pipe($$.rename(name + '.js'))
        .pipe(gulp.dest(buildDir));
}

function browserifyMin() {
    return gulp.src(buildDir + name + '.browserify.js')
        .pipe($$.browserify())
        //.pipe($$.sourcemaps.init({loadMaps: true}))
        // Add transformation tasks to the pipeline here:
        .pipe($$.uglify())
        //.on('error', $$.gutil.log)
        //.pipe($$.sourcemaps.write('./'))
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

function browserSyncLaunchServer() {
    browserSync.init({
        server: {
            // Serve up our build folder
            baseDir: buildDir,
            routes: {
                "/bower_components": "bower_components"
            }
        },
        port: 5000
    });
}

function clearBashScreen() {
    var ESC = '\x1B';
    console.log(ESC + 'c'); // (VT-100 escape sequence)
}
