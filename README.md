# ng-attr-hint

[![npm version](https://badge.fury.io/js/ng-attr-hint.svg)](http://badge.fury.io/js/ng-attr-hint) ![license](https://img.shields.io/badge/license-MIT-blue.svg)

A tiny, static linting tool for angular ng-module directives.

##Usage

Install from npm

> npm install ng-attr-hint

```javascript

var ngAttrHint = require('ng-attr-hint');

// callback
ngAttrHint({
	files: ['./*.html']
}, function(err, res) {
	if(err) console.error(err);
	else  {
		ngAttrHint.format(data).forEach(function(o) {
			console.log(o)
		});
	}
});

// promise
ngAttrHint({
	files: ['./*.html']
}).then(function(data) {
	ngAttrHint.format(data).forEach(function(o) {
		console.log(o)
	});
}, function(err) {
	console.error(err)
});

```

### Output (e.g.)
```
[./sample.html:6] [warning] (href) Duplicate attribute href
[./sample.html:7] [warning] (ngShow,ngHide) Mutually exclusive directives: ngShow, ngHide
[./sample.html:10] [warning] (ngShow) Empty attribute ngShow
[./sample.html:12] [warning] (ngBindHtmlUnsafe) Deprecated directive 'ngBindHtmlUnsafe'. Use 'ng-bind-html' instead
[./sample.html:14] [warning] (onchange,ngChange) Complementary directives. Got: onchange, ngChange
[./sample.html:15] [warning] (onchange) Instead of 'onchange' use angular counterpart 'ngChange'
[./sample.html:28] [warning] (ngOptions) Do not use select as and track by in the same expression. They are not 
designed to work together.

[./sample.html:31] [warning] (ngOptions) Expected expression in form of '_select_ (as _label_)? for (_key_,)?_value_ 
in _collection_' but got 'item.subItem for item as values'. Element: '<select>'
[./sample.html:34] [warning] (ngAttrCx,cx) Complementary directives. Got: ngAttrCx, cx
[./sample.html:37] [warning] (ngTrim) ng-trim parameter is ignored for input[type=password] controls, which will never
 trim the input
[./sample.html:39] [warning] (ngInit) The only appropriate use of ngInit is for aliasing special properties of 
ngRepeat, as seen in the demo below. Besides this case, you should use controllers rather than ngInit to initialize values on a
 scope.
[./sample.html:54] [warning] (ngClassOdd) work in conjunction with ngRepeat and take effect only on odd (even) rows
[./sample.html:56] [warning] (ngRepeat) track by must always be the last expression
[./sample.html:13] [info] (ng-band) Custom directive 'ng-band' or misspelled? Did you mean 'ng-bind'?
[./sample.html:14] [info] (ng-cilck) Custom directive 'ng-cilck' or misspelled? Did you mean 'ng-click'?
[./sample.html:15] [info] (ng-triim) Custom directive 'ng-triim' or misspelled? Did you mean 'ng-trim'?
[./sample.html:16] [info] (ng-repaet) Custom directive 'ng-repaet' or misspelled? Did you mean 'ng-repeat'?
[./sample.html:17] [info] (ng-desapled) Custom directive 'ng-desapled' or misspelled? Did you mean 'ng-disabled'?

```

### API
### function format(hints, formatPattern)
> format the hint object to array of strings

Parameters:
```
hints
  Output of ngAttrHint (An array of hint objects)
formatPattern
  Optional Paramater. formatPattern, if provided, will be used for formatting.
  Use '{field}' to interpolate hint object.
  Default pattern : `[{file}:{line}] [{type}] ({attrs}) {message}`
```
`ngAttrHint` object format: 

``` javascript
{
  file: string,
  line: number,
  type: string,
  attrs: [string],
  message: string
}

```

### Build
[Gulp task](https://gist.github.com/princejwesley/679f092fd1f2ac2ad21c)

Grunt - TODO

####TODOs

Unit tests

Online demo Page @ toolitup.com


## License
This plugin is licensed under the [MIT license](https://github.com/princejwesley/ng-attr-hint/blob/master/LICENSE).

Copyright (c) 2015 [Prince John Wesley](http://www.toolitup.com)
