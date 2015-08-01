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
  ['ngShow', 'ngHide'],
  ['ngBind', 'ngBindHtml', 'ngBindTemplate'],
];

var complementaryTags = [
  ['href', 'ngHref'],
  ['required', 'ngRequired'],
  ['src', 'ngSrc'],
  ['readonly', 'ngReadonly'],
];

var aliasTags = [
  ['minlength', 'ngMinlength'],
  ['maxlength', 'ngMaxlength'],
  ['min', 'ngMin'],
  ['max', 'ngMax'],
  ['pattern', 'ngPattern'],
];

var emptyAttributes = ['ngCloak', 'ngTransclude'];

//https://github.com/angular/angular.js/blob/master/src/ng/directive/ngOptions.js#L218
//                     //00001111111111000000000002222222222000000000000000000000333333333300000000000000000000000004444444444400000000000005555555555555550000000006666666666666660000000777777777777777000000000000000888888888800000000000000000009999999999
var NG_OPTIONS_REGEXP = /^\s*([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+group\s+by\s+([\s\S]+?))?(?:\s+disable\s+when\s+([\s\S]+?))?\s+for\s+(?:([\$\w][\$\w]*)|(?:\(\s*([\$\w][\$\w]*)\s*,\s*([\$\w][\$\w]*)\s*\)))\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?$/;

//https://github.com/angular/angular.js/blob/9efb0d5ee961b57c8fc144a3138a15955e4010e2/src/jqLite.js#L136
var SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g;
var MOZ_HACK_REGEXP = /^moz([A-Z])/;

function camelCase(name) {
  return name.
    replace(SPECIAL_CHARS_REGEXP, function(_, separator, letter, offset) {
      return offset ? letter.toUpperCase() : letter;
    }).
    replace(MOZ_HACK_REGEXP, 'Moz$1');
}

//https://github.com/angular/angular.js/blob/6f3b8622adce2006df5cf7eed4bf9262539004bd/src/ng/compile.js#L2661
var PREFIX_REGEXP = /^((?:x|data)[\:\-_])/i;

function directiveNormalize(name) {
  return camelCase(name.replace(PREFIX_REGEXP, ''));
}

// helper

function pushResults(location, type, attr, message, result) {
  var loc = location.split(':');
  result.push({
    file: loc[0],
    line: parseInt(loc[1]),
    type: type,
    attrs: attr,
    message: message
  });
}


// rules

var RULE = {};

RULE.$INTERSECTIONS = function(attrsInfo, tagList, msg, result) {
  var keys = attrsInfo.attrKeys;
  _.each(tagList, function(tags) {
    var common = _.intersection(tags, keys);
    if (common.length > 1) {
      pushResults(attrsInfo.attributes.__loc__, 'warning', common, msg + common.join(', '), result);
    }
  });
};

Object.defineProperty(RULE, '$INTERSECTIONS', { enumerable: false });

RULE.MUTUALLY_EXCLUSIVES = function(attrsInfo, result) {
  RULE.$INTERSECTIONS(attrsInfo, mutuallyExclusives, 'Mutually exclusive directives ', result);
};

RULE.COMPLEMENTARY_TAGS = function(attrsInfo, result) {
  RULE.$INTERSECTIONS(attrsInfo, complementaryTags, 'Complementary directives ', result);
};

RULE.ALIAS_TAGS = function(attrsInfo, result) {
  RULE.$INTERSECTIONS(attrsInfo, aliasTags, 'Alias directives ', result);
};

RULE.DUPLICATES = function(attrsInfo, result) {
  // duplicates
  _(attrsInfo.dups)
    .keys()
    .each(function(dup) {
      pushResults(attrsInfo.attributes.__loc__, 'warning', [dup], 'Duplicate attribute ' + dup, result);
    })
    .value();
};


RULE.NG_TRIM = function(attrsInfo, result) {
  var attrs = attrsInfo.attrs;
  if (!('ngTrim' in attrs) || attrsInfo.tagName !== 'input' || attrs.type !== 'password') return;

  pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngTrim'],
    "ng-trim parameter is ignored for input[type=password] controls, which will never trim the input", result);
};

RULE.NG_INIT = function(attrsInfo, result) {
  var attrs = attrsInfo.attrs;
  if (('ngRepeat' in attrs) || !('ngInit' in attrs)) return;

  pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngInit'],
    "The only appropriate use of ngInit is for aliasing special properties of ngRepeat, as seen in the demo below. Besides this case, you should use controllers rather than ngInit to initialize values on a scope.",
    result);
};

RULE.NG_REPEAT = function(attrsInfo, result) {
  var attrs = attrsInfo.attrs;
  if (!('ngRepeat' in attrs)) return;

  var value = attrs['ngRepeat'], trimFunValue = value.replace(/\(\s*([\S]*)\s*\)/g, '($1)');

  if (trimFunValue.match(/\strack\s+by\s+(?:[\S]+)\s+(?:[\S]+)/)) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngRepeat'], "track by must always be the last expression", result);
  }

  var match;
  // https://github.com/angular/angular.js/blob/master/src/ng/directive/ngRepeat.js#L338
  if(!(match = value.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/))) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngRepeat'],
      ["Expected expression in form of '_item_ in _collection_[ track by _id_]' but got '", value, "'."].join(''), result);
  } else {
    var m1 = match[1];
    var aliasAs = match[3];

    if(!(match = m1.match(/^(?:(\s*[\$\w]+)|\(\s*([\$\w]+)\s*,\s*([\$\w]+)\s*\))$/))) {
      pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngRepeat'], 
        ["'_item_' in '_item_ in _collection_' should be an identifier or '(_key_, _value_)' expression, but got '", m1, "'."].join(''), result);
    }

    if (aliasAs && (!/^[$a-zA-Z_][$a-zA-Z0-9_]*$/.test(aliasAs) ||
        /^(null|undefined|this|\$index|\$first|\$middle|\$last|\$even|\$odd|\$parent|\$root|\$id)$/.test(aliasAs))) {
      pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngRepeat'],
        ["alias '", aliasAs, "' is invalid --- must be a valid JS identifier which is not a reserved name."].join(''), result);
    }
  }
};


RULE.NG_OPTIONS = function(attrsInfo, result) {
  var attrs = attrsInfo.attrs;
  if (!('ngOptions' in attrs)) return;

  var options = attrs['ngOptions'];

  if (!options) return;

  if (!options.match(NG_OPTIONS_REGEXP)) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngOptions'], 
      ["Expected expression in form of '_select_ (as _label_)? for (_key_,)?_value_ in _collection_' but got '",
        options, "'. Element: '<", attrsInfo.tagName, ">'"
      ].join(''), result);
  }

  if (options.match(/\s+as\s+(.*?)\strack\s+by\s/)) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngOptions'],
      "Do not use select as and track by in the same expression. They are not designed to work together.", result);
  }
};


RULE.$NG_OPEN_EVEN_ODD = function(attrsInfo, attrName, result) {
  var attrs = attrsInfo.attrs;
  if (!(attrName in attrs)) return;

  var value = attrs[attrName] || '';
  var node = attrsInfo.node;
  var hasNgRepeat = false;

  while(node.parent) {
    if('ngRepeat' in node.data.attrs) {
      hasNgRepeat = true;
      break;
    }
    node = node.parent;
  }

  if(!hasNgRepeat) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', [attrName],
      "work in conjunction with ngRepeat and take effect only on odd (even) rows", result);
  }
};

Object.defineProperty(RULE, '$NG_OPEN_EVEN_ODD', { enumerable: false });

RULE.NG_OPEN_EVEN = function(attrsInfo, result) {
  RULE.$NG_OPEN_EVEN_ODD(attrsInfo, 'ngClassEven', result);
};

RULE.NG_OPEN_ODD = function(attrsInfo, result) {
  RULE.$NG_OPEN_EVEN_ODD(attrsInfo, 'ngClassOdd', result);
};


RULE.EMPTY_NG = function(attrsInfo, result) {
  _.each(attrsInfo.attrKeys, function(key) {
    // empty ng attributes
    if (_.isEmpty(attrsInfo.attrs[key]) &&
      _.startsWith(key, 'ng') &&
      emptyAttributes.indexOf(key) === -1 &&
      attrsInfo.settings.ignoreAttributes.indexOf(key) === -1) {
      pushResults(attrsInfo.attributes.__loc__, 'warning', [key], 'Empty attribute ' + key, result);
    }
  });

};

// rule ends

var RULES = _.keys(RULE);

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
  var tree = {};
  var root = tree;
  var p = new htmlParser.Parser({
    onopentag: function(name, attributes) {
      var child = {
        data: { name: name, attrs: attrs },
        parent: root
      };
      root.children = root.children ? root.children : [];
      root.children.push(child);
      root = root.children[root.children.length - 1];

      var attrsInfo = {
        tagName: name,
        // normalized
        attrs: attrs,
        // original
        attributes: attributes,
        dups: dups,
        attrKeys: _.keys(attrs),
        settings: settings,
        node: child
      };

      _.each(RULES, function(rule) {
        RULE[rule](attrsInfo, result);
      })

      attrs = {};
      dups = {};
    },
    onclosetag: function(name) {
      if(root.parent) root = root.parent;
    },
    onattribute: function(name, value) {
      if(name === '__loc__') return;

      var normalizedName = directiveNormalize(name);

      if(normalizedName in attrs) dups[normalizedName] = value;
      else attrs[normalizedName] = value;
    },
    onend: function() {
      deferred.resolve(result);
    }
  }, { lowerCaseTags: true });
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

  if (hasCallback) {
    result.nodeify(callback);
  } else {
    result.then(deferred.resolve, failure);
  }
  return deferred.promise;
};