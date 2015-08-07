# ng-attr-hint

[![npm version](https://badge.fury.io/js/ng-attr-hint.svg)](http://badge.fury.io/js/ng-attr-hint) ![license](https://img.shields.io/badge/license-MIT-blue.svg)

A static linting tool for angular ng directives.


### Usage

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

### Output of [Gulp task](https://gist.github.com/princejwesley/679f092fd1f2ac2ad21c)
![ng-attr-hint](https://gist.githubusercontent.com/princejwesley/accb5688eaf40ae338af/raw/38549764e5ae53fd9324b8c8f0d6ead6d43d9f6c/ng-attr-hint.png)


### API
### function(options, callback)
> Constructor which takes options and an optional callback. if callback is not provided, function will return a promise instance.

Parameters:
```
options
  {
    files:[glob string]
  }

callback
  Optional function which will be used to return the array of hint object.

```


### function format(hints, formatPattern)
> format the hint object to array of strings

Parameters:
```
hints
  Output of ngAttrHint (An array of hint objects)
formatPattern
  Optional Paramater. formatPattern, if provided, will be used for formatting.
  Use '{field}' to interpolate hint object.
  Default pattern : '[{file}:{line}] [{type}] ({attrs}) {message}'
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

####TODOs

* Unit tests
* grunt task
* demo page


## License
This plugin is licensed under the [MIT license](https://github.com/princejwesley/ng-attr-hint/blob/master/LICENSE).

Copyright (c) 2015 [Prince John Wesley](http://www.toolitup.com)
