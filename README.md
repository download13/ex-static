# Deprecated

ex-static
=========

Serves files. It's pretty fast.

### To use:
```javascript
var http = require('http');
var static = require('ex-static');

var files = [
	{url: '/', path: 'static/index.html'},
	{url: '/test.jar', path: 'static/test.jar', type: 'application/java-archive', cache: 300000, compress: true}
];

http.createServer(static(files)).listen(80);
```

* `cache` - Sets the number of seconds on the `Cache-Control: max-age` header. Using 0 sets no header.
* `type`  - Used to specify a `Content-Type`, or override the default type associated with the file extension.
* `compress` - Set whether we should use compression. Small files have it on by default.
* `stream` - True if the file should be streamed to the client, false if it should be written in one chunk. Defaults to true for small files.
* `path` - The local file path where the file can be found.
* `url` - The url where the file should be served.


All files have `ETag` values that are the MD5 hashes of their contents.

Small files are compressed with gzip for browsers that support it. To override the default compression setting for a file, use the `compress` parameter.
