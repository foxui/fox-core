
/* jshint node: true */
module.exports = function(grunt) {
  'use strict';

  // Force use of Unix newlines
  grunt.util.linefeed = '\n';

  RegExp.quote = function (string) {
    return string.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
  };

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    // Metadata.
    meta: {
      distPath:       'dist/',
      srcPath: 'src/'
    },

    banner: '/*!\n' +
            ' * =====================================================\n' +
            ' * Foxui v<%= pkg.version %> (<%= pkg.homepage %>)\n' +
            ' * Copyright <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
            ' * Licensed under <%= pkg.license %> (https://github.com/foxui/fox-core/blob/master/LICENSE)\n' +
            ' *\n' +
            ' * v<%= pkg.version %> designed by @fex-team.\n' +
            ' * =====================================================\n' +
            ' */\n',

    clean: {
      dist: ['<%= meta.distPath %>']
    },

    concat: {
      foxui: {
        options: {
          banner: '<%= banner %>'
        },
        src: [
          'lib/zepto.js',
          'lib/rivets.js',
          'lib/x-tag-core.js',
          'lib/url.js',
          'lib/HTMLImports.js',
          'src/root.js',
          'src/rivets_extend.js',
          'src/utils.js',
          'src/log.js',
          'src/extend.js',
          'src/register.js',
          'src/nav.js',
          'src/datasource.js'
        ],
        dest: '<%= meta.distPath %>foxui.js'
      }
    },

    sass: {
      options: {
        banner: '<%= banner %>',
        style: 'expanded',
        unixNewlines: true
      },
      dist: {
        files: {
          '<%= meta.distPath %>foxui.css': 'sass/foxui.scss'
        }
      }
    },

    csscomb: {
      options: {
        config: 'sass/.csscomb.json'
      },
      dist: {
        files: {
          '<%= meta.distPath %>foxui.css': '<%= meta.distPath %>/foxui.css'
        }
      }
    },

    copy: {
      fonts: {
        expand: true,
        src: 'fonts/*',
        dest: '<%= meta.distPath %>'
      }
    },

    cssmin: {
      options: {
        banner: '', // set to empty; see bellow
        keepSpecialComments: '*' // set to '*' because we already add the banner in sass
      },
      foxui: {
        src: '<%= meta.distPath %>foxui.css',
        dest: '<%= meta.distPath %>foxui.min.css'
      }
    },

    uglify: {
      options: {
        banner: '<%= banner %>',
        compress: true,
        mangle: true,
        preserveComments: false
      },
      foxui: {
        src: '<%= concat.foxui.dest %>',
        dest: '<%= meta.distPath %>foxui.min.js'
      }
    },

    watch: {
      sass: {
        files: [
          '<%= meta.srcPath %>**/*.scss'
        ],
        tasks: ['sass']
      },

      scripts: {
        files: [
          '<%= meta.srcPath %>**/*.js'
        ],
        tasks: ['dist-js']
      }
    },

    jshint: {
      options: {
        jshintrc: 'js/.jshintrc'
      },
      grunt: {
        src: ['Gruntfile.js', 'grunt/*.js']
      },
      src: {
        src: 'js/*.js'
      }
    },

    jscs: {
      options: {
        config: 'js/.jscsrc'
      },
      grunt: {
        src: '<%= jshint.grunt.src %>'
      },
      src: {
        src: '<%= jshint.src.src %>'
      }
    },

    csslint: {
      options: {
        csslintrc: 'sass/.csslintrc'
      },
      src: [
        '<%= meta.distPath %>/css/<%= pkg.name %>.css',
        '<%= meta.distPath %>/css/<%= pkg.name %>-theme-android.css',
        '<%= meta.distPath %>/css/<%= pkg.name %>-theme-ios.css'
      ]
    },

    qunit: {
      files: ['test/test.html']
    }
  });

  // Load the plugins
  require('load-grunt-tasks')(grunt, { scope: 'devDependencies' });
  require('time-grunt')(grunt);

  // Default task(s).
  grunt.registerTask('dist-css', ['sass', 'csscomb', 'cssmin']);
  grunt.registerTask('dist-js', ['concat', 'uglify']);
  grunt.registerTask('dist', ['clean', 'dist-css', 'dist-js', 'copy']);
  grunt.registerTask('build', ['dist']);
  grunt.registerTask('default', ['dist']);
  grunt.registerTask('test', ['dist', /*'csslint', 'jshint', 'jscs',*/ 'qunit']);

};
