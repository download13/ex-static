ex-static
=========

**WARNING: DO NOT USE ON LARGE FILES!**
`ex-static` keeps all file data in memory and so is not recommended for files larger than a megabyte (unless you have a lot of spare RAM).
Now also watches files for changes and reloads them when needed.

### To use:
```javascript
var http = require('http');
var mw = require('simpleware').mw;
var static = require('ex-static');

var staticFiles = [
	{url: '/', path: 'static/index.html'},
	{url: '/test.jar', path: 'static/test.jar', type: 'application/java-archive', cache: -1, compress: true}
];

http.createServer(mw(staticFiles)).listen(80);
```

The `cache` parameter sets the number of seconds on the `Cache-Control: max-age` header. Using -1 sets a very large value while using 0 sets no header.
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
