# ng-attr-hint

[![npm version](https://badge.fury.io/js/ng-attr-hint.svg)](http://badge.fury.io/js/ng-attr-hint)

A tiny node plugin for static angular directive hints

##Usage

Install from npm

> npm install ng-attr-hint

```javascript

var ngAttrHint = require('ng-attr-hint');

// callback
ngAttrHint({
	files: ['./ang..e.html']
}, function(err, res) {
	if(err) console.error(err);
	else  {
		lint.format(data).forEach(function(o) {
			console.log(o)
		});
	}
});

// promise
ngAttrHint({
	files: ['./ang..e.html']
}).then(function(data) {
	lint.format(data).forEach(function(o) {
		console.log(o)
	});
}, function(err) {
	console.error(err)
});

```

### Output
```
[./ang..e.html:6] [warning] (href) Duplicate attribute href
[./ang..e.html:7] [warning] (ngShow,ngHide) Mutually exclusive directives: ngShow, ngHide
[./ang..e.html:10] [warning] (ngShow) Empty attribute ngShow
[./ang..e.html:12] [warning] (ngBindHtmlUnsafe) Deprecated directive 'ngBindHtmlUnsafe'. Use 'ng-bind-html' instead
[./ang..e.html:14] [warning] (onchange,ngChange) Complementary directives. Got: onchange, ngChange
[./ang..e.html:15] [warning] (onchange) Instead of 'onchange' use angular counterpart 'ngChange'
[./ang..e.html:18] [warning] (href) Expected href inside <a> tag but got <'div'>
[./ang..e.html:28] [warning] (ngOptions) Do not use select as and track by in the same expression. They are not 
designed to work together.

[./ang..e.html:31] [warning] (ngOptions) Expected expression in form of '_select_ (as _label_)? for (_key_,)?_value_ 
in _collection_' but got 'item.subItem for item as values'. Element: '<select>'
[./ang..e.html:34] [warning] (ngAttrCx,cx) Complementary directives. Got: ngAttrCx, cx
[./ang..e.html:37] [warning] (ngTrim) ng-trim parameter is ignored for input[type=password] controls, which will never
 trim the input
[./ang..e.html:39] [warning] (ngInit) The only appropriate use of ngInit is for aliasing special properties of 
ngRepeat, as seen in the demo below. Besides this case, you should use controllers rather than ngInit to initialize values on a
 scope.
[./ang..e.html:54] [warning] (ngClassOdd) work in conjunction with ngRepeat and take effect only on odd (even) rows
[./ang..e.html:56] [warning] (ngRepeat) track by must always be the last expression
[./ang..e.html:13] [info] (ng-band) Custom directive 'ng-band' or misspelled? Did you mean 'ng-bind'?
[./ang..e.html:14] [info] (ng-cilck) Custom directive 'ng-cilck' or misspelled? Did you mean 'ng-click'?
[./ang..e.html:15] [info] (ng-triim) Custom directive 'ng-triim' or misspelled? Did you mean 'ng-trim'?
[./ang..e.html:16] [info] (ng-repaet) Custom directive 'ng-repaet' or misspelled? Did you mean 'ng-repeat'?
[./ang..e.html:17] [info] (ng-desapled) Custom directive 'ng-desapled' or misspelled? Did you mean 'ng-disabled'?

```


##### Default Settings
```javascript
	var settings = {
		// files to analyse
		files: [],
		// file encoding
		fileEncoding: 'utf8',
	}
```
###Integration
grunt - TODO

gulp - TODO

## License
This plugin is licensed under the [MIT license](https://github.com/princejwesley/ng-attr-hint/blob/master/LICENSE).

Copyright (c) 2015 [Prince John Wesley](http://www.toolitup.com)
