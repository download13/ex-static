var fs = require('fs');
var url = require('url');
var zlib = require('zlib');
var crypto = require('crypto');

var MIME_TYPES = [
	[/\.html$/, 'text/html'],
	[/\.js$/, 'text/javascript'],
	[/\.css$/, 'text/css'],
	[/\.txt$/, 'text/plain'],
	
	[/\.jpg$/, 'image/jpeg'],
	[/\.png$/, 'image/png'],
	[/\.gif$/, 'image/gif'],
	
	[/\.ogg$/, 'application/ogg'],
	[/\.ogv$/, 'video/ogg'],
	[/\.oga$/, 'audio/ogg'],
	[/\.mp3$/, 'audio/mp3'],
	[/\.wav$/, 'audio/wav'],
	
	[/\.jar$/, 'application/java-archive']
];
var TIMESTAMP = Date.now().toString();

function FileServer() {
	this.staticCache = {};
	this.handleRequest = this.handleRequest.bind(this);
}

// A URL of * will match all requests not matched by another handler

FileServer.prototype = {
	addFile: function(options) {
		var self = this;
		
		var url = options.url;
		var path = options.path;
		var type = options.type;
		var cache = Boolean(options.cache);
		var compress = Boolean(options.compress);
		
		if(type == null) { // Find out what the MIME type is
			for(var i = 0; i < MIME_TYPES.length; i++) { // Check each one against the file extension until...
				var t = MIME_TYPES[i];
				if(path.match(t[0])) {
					type = t[1];
					break;
				}
			}
			if(type == null) {
				type = 'text/plain';
			}
		}
		
		var data = fs.readFileSync(path) || ''; // It's startup, and we're hoping nobody tried to use this for large files
		
		if(type == 'text/html') { // Rev the HTML files
			data = data.toString('utf8').replace(/\{rev\}/g, TIMESTAMP);
		}
		
		var etag = '"' + crypto.createHash('md5').update(data).digest('hex') + '"';
		
		this.staticCache[url] = {
			type: type, // The MIME type of the content
			cache: cache, // Boolean specifying whether to perma-cache
			path: path, // Local filesystem path
			url: url, // URL path
			data: data, // The content
			compressed: null, // Compressed version of the content, this will be added when it's done compressing
			etag: etag, // An ETag string to caching purposes
			loadedDate: new Date().getTime()
		};
		
		if(compress || type.indexOf('text/') == 0 || type == 'application/javascript' || type == 'audio/wav') {
			zlib.gzip(data, function(err, compressed) {
				if((compressed.length < data.length - 1024 || compressed.length < data.length * 0.9)) {// If the compression ratio is good enough (at least a KB saved or at least 10%)
					self.staticCache[url].compressed = compressed;
					// console.log('Compressed ' + path);
					// express logger
				}// else {
					// console.log("Didn't compress " + path);
				//}
			});
		}
		
		// Disabled for now, no support on Windows
		/*
		fs.watchFile(path, function(c, p) {
			fs.readFile(path, function(err, data) {
				self.staticCache[path].data = data;
			});
		});
		*/
	},
	
	handleRequest: function(req, res, next) {
		var u = url.parse(req.url).pathname;
		var t = this.staticCache[u] || this.staticCache['*'];
		
		if(t != null) {
			var data;
			var not_modified = false;
			var headers =  headers = {'Content-Type': t.type, 'ETag': t.etag};
			
			var ms = req.headers['if-modified-since'], nm = req.headers['if-none-match'];
			if(ms != null && t.loadedDate <= new Date(ms).getTime()) { // If their entity is up-to-date
				not_modified = true;
			} else if(nm != null && nm == t.etag) { // If the etags match
				not_modified = true;
			}
			
			if(not_modified) {
				res.writeHead(304);
				res.end();
			} else { // Send back the usual data   
				if(t.compressed != null && req.headers['accept-encoding'].indexOf('gzip') != -1) { // The file and browser support gzip compression
					data = t.compressed;
					headers['Content-Encoding'] = 'gzip';
				} else {
					data = t.data;
				}
				headers['Content-Length'] = data.length;
				
				if(t.cache) { // Try to cache this file for a long time
					headers['Cache-Control'] = 'max-age=31536000';
				}
				
				if(req.method == 'HEAD') data = null;
				res.writeHead(200, headers);
				res.end(data);
				// console.log('Serving static file ' + t.path + ' on ' + u);
				// How do we log to the express logging system
			}
		} else { // If not handled here
			next();
		}
	}
}

module.exports = function(files) {
	var s = new FileServer();
	
	for(var i = 0, l = files.length; i < l; i++) {
		s.addFile(files[i]);
	}
	
	return s.handleRequest;
}