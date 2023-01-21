module.exports = function(grunt) {
  grunt.registerTask('prod', [
    'polyfill:prod',
    'compileAssets',
    'babel',    
    'concat',
    'uglify',
    'cssmin',
    'sails-linker:prodJs',
    'sails-linker:prodStyles',
  ]);
};

