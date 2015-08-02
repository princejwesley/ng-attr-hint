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
		files: ['./angular-directive.html']
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
		files: ['./angular-directive.html']
	}).then(function(data) {
		lint.format(data).forEach(function(o) {
			console.log(o)
		});
	}, function(err) {
		console.error(err)
	});

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
