ex-static
=========

**WARNING: DO NOT USE ON LARGE FILES!**
`ex-static` keeps all file data in memory and so is not recommended for files larger than a megabyte (unless you have a lot of spare RAM).

### To use:
```javascript
var express = require('express');
var static = require('ex-static');

var staticFiles = [
	{url: '/', path: 'static/index.html'},
	{url: '/test.jar', path: 'static/test.jar', type: 'application/java-archive', cache: true, compress: true}
];

var app = express.createServer();
app.configure(function() {
	app.use(static(staticFiles));
	app.use(app.router);
});
app.listen(80);
```

The `cache` parameter sets the `Cache-Control: max-age` header to a very large value to ensure that the file is cached for a long time.
All files have `ETag` values that are the MD5 hashes of their contents.
`type` is used to specify a `Content-Type`, or override the default type associated with the file extension.
All `text/*` files are compressed with `gzip` for browsers that support it. To override the default compression setting for a file, use the `compress` parameter.

`ex-static` also supports automatic revving of HTML files.
Any instance of the string `{rev}` in an HTML file will be replaced with a timestamp when the static server starts up.
This is useful for ensuring that users have the latest version of a file even if the `cache` option is enabled.
### Example:
```html
<!DOCTYPE html>
<html>
<head>
<script src="/js/main.js?{rev}"></script>
</head>
<body></body>
</html>
```

### Caveats:
* Do not accidentally call a `next()` function more than once in the same handler. It will cause strange behavior like handlers being called out of order or too many times.
