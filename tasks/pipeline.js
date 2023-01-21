var cssFilesToInject = [

  'dependencies/**/*.css',
  'styles/**/*.css'
];

var jsFilesToInject = [

  'dependencies/sails.io.js',

  'dependencies/**/*.js',

  'js/**/*.js'
];

var templateFilesToInject = [
  'templates/**/*.html'
];



var tmpPath = '.tmp/public/';


module.exports.cssFilesToInject = cssFilesToInject.map((cssPath)=>{
  // If we're ignoring the file, make sure the ! is at the beginning of the path
  if (cssPath[0] === '!') {
    return require('path').join('!' + tmpPath, cssPath.substr(1));
  }
  return require('path').join(tmpPath, cssPath);
});
module.exports.jsFilesToInject = jsFilesToInject.map((jsPath)=>{
  // If we're ignoring the file, make sure the ! is at the beginning of the path
  if (jsPath[0] === '!') {
    return require('path').join('!' + tmpPath, jsPath.substr(1));
  }
  return require('path').join(tmpPath, jsPath);
});
module.exports.templateFilesToInject = templateFilesToInject.map((tplPath)=>{
  // If we're ignoring the file, make sure the ! is at the beginning of the path
  if (tplPath[0] === '!') {
    return require('path').join('!assets/', tplPath.substr(1));
  }
  return require('path').join('assets/', tplPath);
});
