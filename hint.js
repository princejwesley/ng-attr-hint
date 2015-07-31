/*!The MIT License (MIT)

Copyright (c) 2015 Prince John Wesley (princejohnwesley@gmail.com)
**/

'use strict';

var Q = require('q');
var _ = require('lodash');
var fs = require('fs');
var htmlParser = require('htmlparser2');
var through2 = require('through2');

var mutuallyExclusives = [
  ['ng-show', 'ng-hide'],
  ['ng-bind', 'ng-bind-html', 'ng-bind-template'],
];

var emptyAttributes = ['ng-cloak', 'ng-transclude'];

var fileContent = function(filename) {
  var index = 1;
  function lineContent(content) {
    var lines = content.split(/\r?\n/);
    var start = index;
    index += lines.length - 1;
    return _.map(lines, function(line, idx) {
      return line.replace(/(<[\w\s].*?)(\s|>|\/>)/g, '$1 __loc__="' + filename + ':' + (start + idx) + '" $2');
    }).join('\n');
  }
  return lineContent;
};

var parse = function(settings, content) {
  var result = [];
  var deferred = Q.defer();
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
      deferred.resolve(result);
    }
  });
  p.write(content);
  p.end();
  return deferred.promise;
};


function toDataPromise(stream, transform) {
  var deferred = Q.defer();
  var chunks = [];

  function onData(data) {
    chunks.push(data);
  }

  function onEnd() {
    var data = chunks.join('');
    if (typeof transform === 'function') {
      transform(data).then(deferred.resolve, deferred.reject);
    } else {
      deferred.resolve(data);
    }
  }

  stream.on('data', onData);
  stream.on('end', onEnd);
  stream.on('error', deferred.reject);

  return deferred.promise;
}

module.exports = function(options, callback) {
  var settings = _.clone(options, true);
  var hasCallback = typeof callback === 'function';
  var deferred = Q.defer();
  var failure = hasCallback ? callback : deferred.reject;
  var failure2 = hasCallback ? callback : Q.reject;

  if (!settings) return failure2(new Error('Empty Settings'));
  if (!settings.files) return failure2(new Error('Empty files property'));

  if (typeof settings.files === 'string') settings.files = [settings.files];

  if (!_.isArray(settings.files))
    return failure2(new Error('files property takes an array of filenames'));

  if (typeof settings.ignoreAttributes === 'string') settings.ignoreAttributes = [settings.ignoreAttributes];
  else if (!settings.ignoreAttributes) settings.ignoreAttributes = [];

  var streams = _.map(settings.files, function(filename) {
    var fc = fileContent(filename);
    var stream = fs.createReadStream(filename, {
        encoding: settings.fileEncoding || 'utf8'
      })
      .on('error', failure)
      .pipe(through2({
        decodeStrings: false
      }, function(chunk, encoding, callback) {
        callback(null, fc(chunk));
      }));
    return stream;
  });

  var parseSettings = (function(settings) {
    return function(content) {
      return parse(settings, content);
    }
  })(settings);

  var promises = _.map(streams, function(s) {
    return toDataPromise(s, parseSettings);
  });

  var result = Q.all(promises).then(_.flatten);

  if(hasCallback) {
    result.nodeify(callback);
  } else {
    result.then(deferred.resolve, failure);
  }
  return deferred.promise;
};
