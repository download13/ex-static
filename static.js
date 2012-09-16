var fs = require('fs');
var url = require('url');
var zlib = require('zlib');
var crypto = require('crypto');
var mime = require('mime');

function loadFile(filename, cb) {
	var file = {path: filename};
	
	fs.readFile(filename, function(err, data) {
		if(err) return cb(file);
		
		var type = mime.lookup(filename);
		
		file.type = type;
		file.etag = '"' + crypto.createHash('md5').update(data).digest('hex') + '"';
		file.data = data;
		cb(file);
	});
}

function finishFile(file, url, cache, compress, type, cb) {
	if(file.data == null) return cb(file);
	
	var now = Date.now();
	file.timeLoaded = now;
	file.url = url;
	file.cache = cache;
	
	if(type != null) file.type = type;
	if(file.type == 'text/html') { // Rev the HTML files
		file.data = file.data.toString('utf8').replace(/\{rev\}/g, now.toString());
	}
	
	if(compress || file.type.indexOf('text/') == 0 || file.type == 'application/javascript' || file.type == 'audio/x-wav') {
		zlib.gzip(file.data, function(err, compressed) {
			if((compressed.length < file.data.length - 512000 || compressed.length < file.data.length * 0.95)) { // If the compression ratio is good enough (at least 500KB saved or at least 5%)
				file.compressed = compressed;
			}
			
			cb(file);
		});
	} else {
		cb(file);
	}
}

function watchFile(filename, cb) {
	var timeout;
	try {
		fs.watch(filename, {persistent: false}, changed);
	} catch(e) {
		if(e.code == 'ENOENT') {
			console.warn('ex-static: File will not be watched or loaded as it does not exist: ' + filename);
		} else throw e;
	}
	changed();
	
	function changed(type) {
		if(timeout == null) { // Wait since events sometimes fire multiple times in quick succession
			timeout = setTimeout(function() {
				cb();
				timeout = null;
			}, 20);
		}
	}
}

function handleRequest(staticCache, req, res, next) {
	var method = req.method.toUpperCase();
	if(method != 'GET' && method != 'HEAD') {
		if(next) next();
		else {
			res.writeHead(405);
			res.end();
		}
		return;
	}
	
	var file = staticCache[url.parse(req.url).pathname];
	
	if(file != null) {
		var data;
		var not_modified = false;
		var headers = {'Content-Type': file.type, 'ETag': file.etag};
		
		var modifiedSince = req.headers['if-modified-since'], noneMatch = req.headers['if-none-match'];
		if(modifiedSince != null && file.timeLoaded <= new Date(modifiedSince).getTime()) { // If their entity is up-to-date
			not_modified = true;
		} else if(noneMatch != null && noneMatch == file.etag) { // If the etags match
			not_modified = true;
		}
		
		if(not_modified) {
			res.writeHead(304);
			res.end();
		} else {
			var acceptEncoding = req.headers['accept-encoding'];
			if(file.compressed != null && acceptEncoding != null && acceptEncoding.indexOf('gzip') != -1) { // The file and browser support gzip compression
				data = file.compressed;
				headers['Content-Encoding'] = 'gzip';
			} else {
				data = file.data;
			}
			headers['Content-Length'] = data.length;
			
			if(file.cache < 0) file.cache = 31536000;
			if(file.cache > 0) {
				headers['Cache-Control'] = 'max-age=' + file.cache;
			}
			
			if(req.method == 'HEAD') data = null;
			res.writeHead(200, headers);
			res.end(data);
			// How do we log?
		}
	} else {
		if(next) next();
		else { // No file and not in a middleware manager
			res.writeHead(404);
			res.end();
		}
	}
}

module.exports = function(files) {
	var staticCache = {};
	
	files.forEach(function(options) {
		var url = options.url;
		var filename = options.path;
		var cache = options.cache;
		
		watchFile(filename, function() {
			loadFile(filename, function(file) {
				finishFile(file, url, cache, Boolean(options.compress), options.type, function(file) {
					delete staticCache[url];
					if(file.data != null) {
						staticCache[url] = file;
					}
				});
			});
		});
	});
	
	return handleRequest.bind(null, staticCache);
}
// TODO: Write tests and update README