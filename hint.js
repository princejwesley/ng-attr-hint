/*!The MIT License (MIT)

Copyright (c) 2015 Prince John Wesley (princejohnwesley@gmail.com)
**/

'use strict';

var Q = require('q');
var _ = require('lodash');
var fs = require('fs');
var htmlParser = require('htmlparser2');
var through2 = require('through2');
var levenshtein = require('fast-levenshtein');
var glob = require('glob');
var formatter = require('extractjs')();

var mutuallyExclusives = [
  ['ngShow', 'ngHide'],
  ['ngBind', 'ngBindHtml', 'ngBindTemplate'],
  ['ng-switch-when', 'ng-switch-default']
];

var complementaryTags = [
  ['href', 'ngHref'],
  ['required', 'ngRequired'],
  ['src', 'ngSrc'],
  ['readonly', 'ngReadonly'],
  ['onchange', 'ngChange'],
  ['onfocus', 'ngFocus'],
  ['onclick', 'ngClick'],
  ['onkeydown', 'ngKeydown'],
  ['onkeyup', 'ngKeyup'],
  ['onkeypress', 'ngKeypress'],
  ['onmousedown', 'ngMousedown'],
  ['onmouseenter', 'ngMouseenter'],
  ['onmouseleave', 'ngMouseleave'],
  ['onmouseup', 'ngMouseup'],
  ['onmouseover', 'ngMouseover'],
  ['onsubmit', 'ngSubmit'],
  ['ondblclick', 'ngDblclick'],
  ['multiple', 'ngMessagesMultiple'],
];

var aliasTags = [
  ['minlength', 'ngMinlength'],
  ['maxlength', 'ngMaxlength'],
  ['min', 'ngMin'],
  ['max', 'ngMax'],
  ['pattern', 'ngPattern'],
];

// ngSwipeDisableMouse can be empty
var emptyAttributes = ['ngCloak', 'ngTransclude', 'ngSwipeDisableMouse', 'ngMessagesMultiple'];

var html2NgAttributes = {
  'onchange': 'ngChange',
  'onfocus': 'ngFocus',
  'onclick': 'ngClick',
  'onkeydown': 'ngKeydown',
  'onkeyup': 'ngKeyup',
  'onkeypress': 'ngKeypress',
  'onmousedown': 'ngMousedown',
  'onmouseenter': 'ngMouseenter',
  'onmouseleave': 'ngMouseleave',
  'onmouseup': 'ngMouseup',
  'onmouseover': 'ngMouseover',
  'onsubmit': 'ngSubmit',
  'ondblclick': 'ngDblclick',
};

var deprecatedAttributes = { 
  'ngBindHtmlUnsafe' : 'ng-bind-html'
};

//denormalized form
// ng/ngTouch/ngRoute/ngMessage/ module directives included
var ngAttributes = [ 'ng-app', 'ng-bind', 'ng-bind-html', 'ng-bind-template', 'ng-blur', 'ng-change', 'ng-checked',
  'ng-class', 'ng-class-even', 'ng-class-odd', 'ng-click', 'ng-cloak', 'ng-controller', 'ng-copy',
  'ng-csp', 'ng-cut', 'ng-dblclick', 'ng-disabled', 'ng-dirty', 'ng-false-value', 
  'ng-focus', 'ng-form', 'ng-hide', 'ng-hint', 'ng-hint-exclude', 'ng-hint-include', 'ng-href', 'ng-if',
  'ng-include', 'ng-init', 'ng-invalid', 'ng-keydown', 'ng-keypress', 'ng-keyup', 'ng-list', 'ng-maxlength',
  'ng-message', 'ng-message-exp', 'ng-messages', 'ng-messages-include', 'ng-messages-multiple', 'ng-minlength',
  'ng-model', 'ng-model-options', 'ng-mousedown', 'ng-mouseenter', 'ng-mouseleave', 'ng-mousemove',
  'ng-mouseover', 'ng-mouseup', 'ng-non-bindable', 'ng-open', 'ng-options', 'ng-paste', 'ng-pattern',
  'ng-pluralize', 'ng-pristine', 'ng-readonly', 'ng-repeat', 'ng-repeat-start', 'ng-repeat-end',
  'ng-required', 'ng-selected', 'ng-show', 'ng-src', 'ng-srcset', 'ng-style', 'ng-submit',
  'ng-swipe-disable-mouse', 'ng-swipe-left', 'ng-swipe-right', 'ng-switch',
  'ng-switch-default', 'ng-switch-when', 'ng-transclude', 'ng-true-value', 'ng-trim', 'ng-false-value',
  'ng-value', 'ng-valid', 'ng-view',
];


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

var DENORMALIZE_REGEX = /([a-z]+)([A-Z])/g;
function denormalize(camel) {
  return camel.replace(DENORMALIZE_REGEX, function(m, lhs, rhs) {
    return [lhs, rhs.toLowerCase()].join('-'); 
  });
}

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

// threhold value for typo suggesion
var SIMILARITY_THRESHOLD = 3;
var SIMILARITY_LENGTH_THRESHOLD = 3;
var SIMILARITY_LEVEL_THRESHOLD = 3/4;

// similar string
function similar(lhs, rhs) {
  if(Math.abs(lhs.length - rhs.length) > SIMILARITY_LENGTH_THRESHOLD) return;
  var map = _.reduce(lhs.split(''), function(m, c) {
    m[c] = true;
    return m;
  }, {});

  var cmn = _.reduce(rhs.split(''), function(m, c) {
    return m + !!map[c];
  }, 0);

  return (rhs.length * SIMILARITY_LEVEL_THRESHOLD) < cmn;
}

// typo suggession
function suggesion(name) {
  var ngs = ngAttributes;
  return _.filter(ngs, function(ng) {
    return similar(name, ng) && levenshtein.get(name, ng) <= SIMILARITY_THRESHOLD;
  });
}

function isLegacyAttribute(attr) {
  return !!attr.match(/^x-|[_:]/);
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

RULE.MUTUALLY_EXCLUSIVES = function(attrsInfo, result) {
  RULE.$INTERSECTIONS(attrsInfo, mutuallyExclusives, 'Mutually exclusive directives: ', result);
};

RULE.COMPLEMENTARY_TAGS = function(attrsInfo, result) {
  RULE.$INTERSECTIONS(attrsInfo, complementaryTags, 'Complementary directives. Got: ', result);
};

RULE.DEPRECATED = function(attrsInfo, result) {
  var attrs = attrsInfo.attrs;
  _.each(_.keys(deprecatedAttributes), function(deprecate) {
    if(deprecate in attrs) {
      pushResults(attrsInfo.attributes.__loc__, 'warning', [deprecate], 
        ["Deprecated directive '", deprecate, "'. Use '", deprecatedAttributes[deprecate] ,"' instead"].join(''), result);      
    }
  });
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

RULE.NG_OPEN_EVEN = function(attrsInfo, result) {
  RULE.$NG_OPEN_EVEN_ODD(attrsInfo, 'ngClassEven', result);
};

RULE.NG_OPEN_ODD = function(attrsInfo, result) {
  RULE.$NG_OPEN_EVEN_ODD(attrsInfo, 'ngClassOdd', result);
};

RULE.NG_HREF = function(attrsInfo, result) {
  var attrs = attrsInfo.attrs;
  if (!(('ngHref' in attrs) || ('href' in attrs))) return;

  var attr = ('ngHref' in attrs) ? 'ngHref' : 'href';
  var attrValue = _.trim(attrs[attr]);

  if(attrValue.length !== 0 && ('ngClick' in attrs)) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngClick', attr],
      "On Click, href should be emtpty to prevent page reload", result);
  }
};

RULE.LEGACY_ATTRIBUTE_NAME = function(attrsInfo, result) {
  var attrs = attrsInfo.attrs;
  var map = attrsInfo.attrMap;

  // legacy attribute usage like x- prefix, _ and : usage
  _(attrs)
    .keys()
    .filter(function(attr) {
      return isLegacyAttribute(map[attr]);
    })
    .each(function(attr) {
      var msg = formatter(
          ['Prefer using the dash-delimited format (e.g. {denormalized} for {attr}).',
            'If you want to use an HTML validating tool, you can instead use the data-prefixed version (e.g. data-{denormalized} for {attr}).',
            'The other forms shown above are accepted for legacy reasons but we advise you to avoid them'
          ].join(''))
        .interpolate({
          denormalized: denormalize(attr),
          attr: attr
        });

      pushResults(attrsInfo.attributes.__loc__, 'info', [attr], msg, result);
    })
    .value();
};

RULE.$EMPTY_NG = function(attrKey, attrsInfo, result) {
  // empty ng attributes
  if (_.isEmpty(attrsInfo.attrs[attrKey]) &&
    _.startsWith(attrKey, 'ng') &&
    emptyAttributes.indexOf(attrKey) === -1) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', [attrKey], 'Empty attribute ' + attrKey, result);
  }
};

RULE.$NG_ATTR = function(attrKey, attrsInfo, result) {
  // ng-attr- attributes
  if(_.startsWith(attrKey, 'ngAttr')) {
    var attr = attrKey.replace('ngAttr', '').toLowerCase();
    if(attr in attrsInfo.attributes) {
      pushResults(attrsInfo.attributes.__loc__, 'warning', [attrKey, attr], 
        ["Complementary directives. Got: ", [attrKey, attr].join(', ')].join(''), result);      
    }
  }
};

RULE.$NG_ACTIONS = function(attrKey, attrsInfo, result) {
  // onAction HTML attributes
  if((attrKey in html2NgAttributes) && !(html2NgAttributes[attrKey] in attrsInfo.attrs)) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', [attrKey], 
      ["Instead of '", attrKey, "' use angular counterpart '" , html2NgAttributes[attrKey], "'"].join(''), result);      
  }
};

RULE.$TYPO_SUGGESTION = function(attrKey, attrsInfo, result) {
  if(_.startsWith(attrKey, 'ng')) {
    var name = denormalize(attrKey);
    if(ngAttributes.indexOf(name) === -1) {
      var maybes = suggesion(name);
      if(maybes.length !== 0) {
        pushResults(attrsInfo.attributes.__loc__, 'info', [name], 
          ["Custom directive '", name, "' or misspelled? Did you mean '" , maybes.join('/'), "'?"].join(''), result);
      }
    }
  }
};

// ngTouch module rule
RULE.DISABLE_MOUSE_ON_SWIPE = function(attrsInfo, result) {
  var attrs = attrsInfo.attrs;
  if (!('ngSwipeDisableMouse' in attrs)) return;

  if(!(('ngSwipeLeft' in attrs) || ('ngSwipeRight' in attrs))) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngSwipeDisableMouse'],
      "ng-switch-disable-mouse should be used with ng-swipe-left or ng-swipe-right", result);
  }
};

//ngMessage module rule
RULE.$HAS_PARENT = function(attrsInfo, directiveName, parentName, message, result) {
  var attrs = attrsInfo.attrs;
  if (!((directiveName in attrs) || attrsInfo.node.data.name === denormalize(directiveName))) return;

  var node = attrsInfo.node.parent;
  var parent = false;
  var denormalized = denormalize(parentName);

  while(node && node.data) {
    if((parentName in node.data.attrs) || (denormalized === node.data.name)) {
      parent = true;
      break;
    }
    node = node.parent;
  }

  if(!parent) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', [directiveName],
      message, result);
  }
};

_.each(['ngMessage', 'ngMessageExp', 'ngMessagesInclude'], function(directive) {
  var denormalized = denormalize(directive);
  var ruleName = denormalized.replace('-', '_').toUpperCase();
  RULE[ruleName + '_RULE'] = function(attrsInfo, result) {
    RULE.$HAS_PARENT(attrsInfo, directive, 'ngMessages', denormalized + " directive should be inside ng-messages", result);
  };
});


RULE.NG_MESSAGE = function(attrsInfo, result) {
  var attrs = attrsInfo.attrs;
  if (attrsInfo.node.data && attrsInfo.node.data.name === 'ng-message') {
    var hasWhen = 'when' in attrs;
    var hasWhenExp = 'whenExp' in attrs;
    var hasBoth = hasWhen & hasWhenExp;
    var hasOne = hasWhen ^ hasWhenExp;
    if(hasBoth || !hasOne) {
      pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngMessage'],
        'Use exactly one conditional attribute(when or when-exp) inside <ng-message>', result);
    }
  }
};

RULE.NG_MESSAGES_MULTIPLE = function(attrsInfo, result) {
  var attrs = attrsInfo.attrs;
  if (!('ngMessagesMultiple' in attrs)) return;

  if(attrsInfo.node.data.name !== 'ng-messages' && !('ngMessages' in attrs)) {
    pushResults(attrsInfo.attributes.__loc__, 'warning', ['ngMessagesMultiple'],
      'Use ng-messages-multiple with ng-messages', result);
  }
};



// Miscellaneous rules that requires whole attribute iterations
RULE.MISC = function(attrsInfo, result) {
  var iterativeRules = ['$EMPTY_NG', '$NG_ATTR', '$NG_ACTIONS', '$TYPO_SUGGESTION'];
  _.each(attrsInfo.attrKeys, function(key) {
    _.each(iterativeRules, function(property) {
      RULE[property](key, attrsInfo, result);
    });
  });
};

// rule ends

// Non enumerable properties
_.each(_.keys(RULE), function(rule) {
  if(_.startsWith(rule, '$')) {
    Object.defineProperty(RULE, rule, { enumerable: false });
  }
});

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
    dups = {},
    attrMap = {};
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
        attrMap: attrMap,
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
      attrMap = {};
    },
    onclosetag: function(name) {
      if(root.parent) root = root.parent;
    },
    onattribute: function(name, value) {
      if(name === '__loc__') return;

      var normalizedName = directiveNormalize(name);
      // normalized -> denormalized
      attrMap[normalizedName] = name;

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

var defaultFormat = formatter('[{file}:{line}] [{type}] ({attrs}) {message}');

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

  // TODO: Ignore rule should be handled by rule number

  var files = _(settings.files)
    .map(function(pattern) {
      return glob.sync(pattern); 
    })
    .flatten()
    .uniq()
    .value();

  var streams = _.map(files, function(filename) {
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

module.exports.format = function(result, formatPattern) {
  if(!_.isArray(result) || result.length === 0 || 
    _.xor(_.keys(result[0]), ['file', 'line', 'type', 'attrs', 'message']).length !== 0 ) return [];

  var outputFormat = formatPattern ? formatter(formatPattern) : defaultFormat;

  return _.map(result, outputFormat.interpolate);

};
