(function() {
  'use strict';

  var Promise = require('promise');
  var _ = require('lodash');
  var htmlParser = require('htmlparser2');
  var read = Promise.denodeify(require('fs').readFile);


  var mutuallyExclusives = [
    ['ng-show', 'ng-hide'],
    ['ng-bind', 'ng-bind-html', 'ng-bind-template'],
  ];

  var emptyAttributes = ['ng-cloak', 'ng-transclude'];

  var fileContent = function(filename) {
    function lineContent(content) {
      var lines = content.split(/\r?\n/);
      return _.map(lines, function(line, idx) {
        return line.replace(/(<[\w\s].*?)(\s|>|\/>)/g, '$1 __loc__="' + filename + ':' + (idx + 1) + '" $2');
      }).join('\n');
    }
    return lineContent;
  };


  var parse = function(content, settings) {
    var result = [];
    var promise = new Promise(function(resolve, reject) {
      var attrs = {},
        dups = {};
      var p = new htmlParser.Parser({
        onopentag: function(name, attributes) {
          var keys = _.keys(attributes);
          // mutually exclusives
          _.each(mutuallyExclusives, function(me) {
            var common = _.intersection(me, keys);
            if (common.length > 1) {
              result.push({
                location: attrs.__loc__,
                type: 'error',
                attrs: common,
                message: 'Mutually exclusive attributes ' + common.join(', ')
              });
            }
          });

          // duplicates
          _(dups)
            .keys()
            .each(function(dup) {
              result.push({
                location: attrs.__loc__,
                type: 'error',
                attrs: [dup],
                message: 'Duplicate attribute ' + dup
              });
            })
            .value();

          _.each(keys, function(key) {
            // empty ng attributes
            if (_.isEmpty(attributes[key]) &&
              _.startsWith(key, 'ng-') &&
              emptyAttributes.indexOf(key) === -1 &&
              settings.ignoreAttributes.indexOf(key) === -1) {
              result.push({
                location: attrs.__loc__,
                type: 'warning',
                attrs: [key],
                message: 'Empty attribute ' + key
              });
            }
          });

          attrs = {};
          dups = {};
        },
        onattribute: function(name, value) {
          (name in attrs ? dups : attrs)[name] = value;
        },
        onend: function() {
          resolve(result);
        }
      });
      p.write(content);
      p.end();
    });
    return promise;
  };

  module.exports = function(options, callback) {
    var settings = _.clone(options, true);
    var failure = callback || function(err) {
      return Promise.reject(err);
    };

    if (!settings) return failure('Empty Settings');
    if (!settings.files) return failure('Empty files property');

    if (typeof settings.files === 'string') settings.files = [settings.files];

    if (!_.isArray(settings.files))
      return failure('files property takes an array of filenames');

    if (typeof settings.ignoreAttributes === 'string') settings.ignoreAttributes = [settings.ignoreAttributes];
    else if (!settings.ignoreAttributes) settings.ignoreAttributes = [];

    var promises = _(settings.files)
      .map(function(filename) {
        return read(filename, settings.fileEncoding || 'utf8')
          .then(fileContent(filename))
          .then(function(content) {
            return parse(content, settings);
          });
      })
      .value();

    return Promise.all(promises).then(_.flatten).nodeify(callback);
  };

})();